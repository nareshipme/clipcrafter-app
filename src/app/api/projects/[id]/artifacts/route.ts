/**
 * GET /api/projects/[id]/artifacts
 * Returns presigned download URLs for all artifacts of a project:
 *   - video (R2 original)
 *   - audio (extracted MP3)
 *   - transcript (JSON)
 *   - highlights (JSON)
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getSupabaseUserId } from "@/lib/user";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, status, r2_key, audio_key, title")
    .eq("id", id)
    .single();

  if (error || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const EXPIRES = 3600; // 1 hour
  const artifacts: Record<string, { url: string; label: string; available: boolean }> = {};

  // Video (R2)
  if (project.r2_key && !project.r2_key.startsWith("http")) {
    try {
      const url = await getSignedUrl(
        r2Client,
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: project.r2_key }),
        { expiresIn: EXPIRES }
      );
      artifacts.video = { url, label: "Video (MP4)", available: true };
    } catch {
      artifacts.video = { url: "", label: "Video (MP4)", available: false };
    }
  } else if (project.r2_key?.startsWith("http")) {
    // YouTube — original URL
    artifacts.video = { url: project.r2_key, label: "YouTube Source", available: true };
  }

  // Audio (extracted MP3)
  if (project.audio_key) {
    try {
      const url = await getSignedUrl(
        r2Client,
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: project.audio_key }),
        { expiresIn: EXPIRES }
      );
      artifacts.audio = { url, label: "Audio (MP3)", available: true };
    } catch {
      artifacts.audio = { url: "", label: "Audio (MP3)", available: false };
    }
  } else {
    artifacts.audio = { url: "", label: "Audio (MP3)", available: false };
  }

  // Transcript (JSON from Supabase)
  const { data: transcript } = await supabaseAdmin
    .from("transcripts")
    .select("id, segments")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (transcript) {
    // Encode transcript as a data URL (no R2 needed for JSON)
    const json = JSON.stringify({ project_id: id, segments: transcript.segments }, null, 2);
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    artifacts.transcript = { url: dataUrl, label: "Transcript (JSON)", available: true };
  } else {
    artifacts.transcript = { url: "", label: "Transcript (JSON)", available: false };
  }

  // Highlights (JSON from Supabase)
  const { data: highlights } = await supabaseAdmin
    .from("highlights")
    .select("id, segments")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (highlights) {
    const json = JSON.stringify({ project_id: id, segments: highlights.segments }, null, 2);
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    artifacts.highlights = { url: dataUrl, label: "Highlights (JSON)", available: true };
  } else {
    artifacts.highlights = { url: "", label: "Highlights (JSON)", available: false };
  }

  return Response.json({ artifacts }, { status: 200 });
}
