import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * GET /api/clips/[clipId]/download
 * Issues a fresh presigned redirect so stale export_url values don't block downloads.
 */

type ClipDownloadRow = {
  id: string;
  export_url: string | null;
  clip_title: string | null;
  title: string | null;
  projects: { user_id: string } | null;
};

function buildFilename(raw: string, clipId: string): string {
  return (
    raw
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || `clip-${clipId}`
  );
}

/** Extract R2 object key from a presigned URL: /<bucket>/<key...> → <key...> */
function extractR2Key(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts.slice(1).join("/") : null;
  } catch {
    return null;
  }
}

async function getFreshUrl(exportUrl: string, filename: string): Promise<string | null> {
  const key = extractR2Key(exportUrl);
  if (!key) return null;
  try {
    return await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}.mp4"`,
      }),
      { expiresIn: 3600 }
    );
  } catch {
    return null;
  }
}

async function resolveClip(clipId: string): Promise<ClipDownloadRow | null> {
  const { data, error } = await supabaseAdmin
    .from("clips")
    .select("id, export_url, clip_title, title, projects(user_id)")
    .eq("id", clipId)
    .single();
  if (error || !data) return null;
  return data as unknown as ClipDownloadRow;
}

export async function GET(_request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return new Response("Unauthorized", { status: 401 });

  const { clipId } = await params;
  const clip = await resolveClip(clipId);

  if (!clip) return new Response("Not found", { status: 404 });
  if (clip.projects?.user_id !== supabaseUserId) return new Response("Forbidden", { status: 403 });
  if (!clip.export_url) return new Response("Not exported yet", { status: 404 });

  const filename = buildFilename(clip.clip_title ?? clip.title ?? `clip-${clipId}`, clipId);
  return streamClip(clip.export_url, filename);
}

async function streamClip(exportUrl: string, filename: string): Promise<Response> {
  // Re-sign via R2 key → avoids stale presigned URL (7-day expiry)
  const freshUrl = await getFreshUrl(exportUrl, filename);
  if (freshUrl) return Response.redirect(freshUrl, 302);

  // Fallback: proxy (handles edge cases where key extraction fails)
  const r2Res = await fetch(exportUrl);
  if (!r2Res.ok) return new Response("Export unavailable — please re-export", { status: 410 });

  return new Response(r2Res.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}.mp4"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
