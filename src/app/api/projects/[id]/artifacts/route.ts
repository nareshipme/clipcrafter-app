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

async function buildVideoArtifact(
  r2Key: string
): Promise<{ url: string; label: string; available: boolean }> {
  if (!r2Key) return { url: "", label: "Video (MP4)", available: false };
  if (r2Key.startsWith("http")) return { url: r2Key, label: "YouTube Source", available: true };
  try {
    const url = await getSignedUrl(
      r2Client,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }),
      { expiresIn: 7 * 3600 } // 7 hours — long enough for an editing session
    );
    return { url, label: "Video (MP4)", available: true };
  } catch {
    return { url: "", label: "Video (MP4)", available: false };
  }
}

async function buildAudioArtifact(
  audioKey: string | null
): Promise<{ url: string; label: string; available: boolean }> {
  if (!audioKey) return { url: "", label: "Audio (MP3)", available: false };
  try {
    const url = await getSignedUrl(
      r2Client,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: audioKey }),
      { expiresIn: 7 * 3600 }
    );
    return { url, label: "Audio (MP3)", available: true };
  } catch {
    return { url: "", label: "Audio (MP3)", available: false };
  }
}

async function buildTranscriptArtifact(
  projectId: string
): Promise<{ url: string; label: string; available: boolean }> {
  const { data: transcript } = await supabaseAdmin
    .from("transcripts")
    .select("id, segments")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!transcript) return { url: "", label: "Transcript (JSON)", available: false };
  const json = JSON.stringify({ project_id: projectId, segments: transcript.segments }, null, 2);
  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  return { url: dataUrl, label: "Transcript (JSON)", available: true };
}

async function buildHighlightsArtifact(
  projectId: string
): Promise<{ url: string; label: string; available: boolean }> {
  const { data: highlights } = await supabaseAdmin
    .from("highlights")
    .select("id, segments")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!highlights) return { url: "", label: "Highlights (JSON)", available: false };
  const json = JSON.stringify({ project_id: projectId, segments: highlights.segments }, null, 2);
  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  return { url: dataUrl, label: "Highlights (JSON)", available: true };
}

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

  const [video, audio, transcript, highlights] = await Promise.all([
    buildVideoArtifact(project.r2_key ?? ""),
    buildAudioArtifact(project.audio_key),
    buildTranscriptArtifact(id),
    buildHighlightsArtifact(id),
  ]);
  const artifacts = { video, audio, transcript, highlights };
  return Response.json({ artifacts }, { status: 200 });
}
