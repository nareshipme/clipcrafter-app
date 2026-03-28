import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

/**
 * GET /api/clips/[clipId]/download
 * Proxies the R2 export file through our server with Content-Disposition: attachment
 * so mobile browsers (Safari) download instead of opening inline.
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

  const r2Res = await fetch(clip.export_url);
  if (!r2Res.ok) return new Response("Failed to fetch file", { status: 502 });

  const filename = buildFilename(clip.clip_title ?? clip.title ?? `clip-${clipId}`, clipId);

  return new Response(r2Res.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}.mp4"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
