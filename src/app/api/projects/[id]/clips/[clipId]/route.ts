/**
 * GET  /api/projects/[id]/clips/[clipId] — fetch single clip + captions + presigned video URL
 * PATCH /api/projects/[id]/clips/[clipId] — update clip title, start/end, caption_style, aspect_ratio
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getSupabaseUserId } from "@/lib/user";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface RawSegment {
  start: number;
  end: number;
  text: string;
}

async function resolveProjectOwnership(
  projectId: string,
  clerkUserId: string
): Promise<
  | { supabaseUserId: string; project: { id: string; user_id: string; r2_key: string | null } }
  | { error: Response }
> {
  const supabaseUserId = await getSupabaseUserId(clerkUserId);
  if (!supabaseUserId)
    return { error: Response.json({ error: "Failed to resolve user" }, { status: 500 }) };

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, r2_key")
    .eq("id", projectId)
    .single();

  if (error || !project)
    return { error: Response.json({ error: "Project not found" }, { status: 404 }) };
  if (project.user_id !== supabaseUserId)
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };

  return { supabaseUserId, project };
}

async function buildVideoUrl(r2Key: string | null): Promise<string> {
  if (!r2Key) return "";
  if (r2Key.startsWith("http")) return r2Key; // YouTube URL
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }), {
    expiresIn: 7 * 3600,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, clipId } = await params;
  const result = await resolveProjectOwnership(projectId, userId);
  if ("error" in result) return result.error;
  const { project } = result;

  // Fetch clip — verify it belongs to this project
  const { data: clip, error: clipError } = await supabaseAdmin
    .from("clips")
    .select("*")
    .eq("id", clipId)
    .eq("project_id", projectId)
    .single();

  if (clipError || !clip) return Response.json({ error: "Clip not found" }, { status: 404 });

  // Fetch transcript segments (latest)
  const { data: transcriptData } = await supabaseAdmin
    .from("transcripts")
    .select("segments")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const allSegments: RawSegment[] = Array.isArray(transcriptData?.segments)
    ? (transcriptData.segments as RawSegment[])
    : [];

  // Filter segments for this clip and offset timing to clip-relative (0 = clip start)
  const captions = allSegments
    .filter((s) => s.end > clip.start_sec && s.start < clip.end_sec)
    .map((s) => ({
      start: Math.max(0, s.start - clip.start_sec),
      end: s.end - clip.start_sec,
      text: s.text.replace(/^\[Speaker \d+\]\s*/, ""),
    }));

  const videoUrl = await buildVideoUrl(project.r2_key);

  return Response.json({ clip, videoUrl, captions }, { status: 200 });
}

type ClipPatchBody = {
  clip_title?: string;
  start_sec?: number;
  end_sec?: number;
  topic?: string;
  caption_style?: string;
  aspect_ratio?: string;
  caption_position?: string;
  caption_size?: string;
  crop_mode?: string;
  crop_x?: number;
  crop_y?: number;
  crop_zoom?: number;
};

function validateTimings(body: ClipPatchBody): { error: Response } | null {
  const { start_sec, end_sec } = body;
  if (start_sec !== undefined && start_sec < 0)
    return { error: Response.json({ error: "start_sec must be >= 0" }, { status: 400 }) };
  if (end_sec !== undefined && end_sec < 0)
    return { error: Response.json({ error: "end_sec must be >= 0" }, { status: 400 }) };
  if (start_sec !== undefined && end_sec !== undefined && start_sec >= end_sec)
    return {
      error: Response.json({ error: "start_sec must be less than end_sec" }, { status: 400 }),
    };
  return null;
}

const ALLOWED_CLIP_FIELDS: (keyof ClipPatchBody)[] = [
  "clip_title",
  "start_sec",
  "end_sec",
  "topic",
  "caption_style",
  "aspect_ratio",
  "caption_position",
  "caption_size",
  "crop_mode",
  "crop_x",
  "crop_y",
  "crop_zoom",
];

function buildClipUpdates(body: ClipPatchBody): Record<string, unknown> {
  return Object.fromEntries(
    ALLOWED_CLIP_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, clipId } = await params;
  const result = await resolveProjectOwnership(projectId, userId);
  if ("error" in result) return result.error;

  const body = (await request.json()) as ClipPatchBody;

  const timingError = validateTimings(body);
  if (timingError) return timingError.error;

  const updates = buildClipUpdates(body);

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data: updatedClip, error: updateError } = await supabaseAdmin
    .from("clips")
    .update(updates)
    .eq("id", clipId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateError || !updatedClip) {
    return Response.json({ error: "Failed to update clip" }, { status: 500 });
  }

  return Response.json({ clip: updatedClip }, { status: 200 });
}
