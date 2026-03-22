/**
 * POST /api/projects/[id]/clips — generate clip rows from highlights
 *   Body (optional): { count?: number, prompt?: string, targetDuration?: number }
 * GET  /api/projects/[id]/clips — list all clips for a project
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { generateHighlights, formatSegmentsForHighlights } from "@/lib/highlights";

async function resolveProjectOwnership(
  projectId: string,
  clerkUserId: string
): Promise<{ supabaseUserId: string; error?: never } | { error: Response; supabaseUserId?: never }> {
  const supabaseUserId = await getSupabaseUserId(clerkUserId);
  if (!supabaseUserId) {
    return { error: Response.json({ error: "Failed to resolve user" }, { status: 500 }) };
  }

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    return { error: Response.json({ error: "Project not found" }, { status: 404 }) };
  }
  if (project.user_id !== supabaseUserId) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabaseUserId };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ownership = await resolveProjectOwnership(id, userId);
  if (ownership.error) return ownership.error;

  // Parse optional generation options from request body
  let count: number | undefined;
  let prompt: string | undefined;
  let targetDuration: number | undefined;
  try {
    const body = await _request.json().catch(() => ({}));
    count = body.count ? Number(body.count) : undefined;
    prompt = body.prompt?.trim() || undefined;
    targetDuration = body.targetDuration ? Number(body.targetDuration) : undefined;
  } catch { /* no body is fine */ }

  // Fetch transcript segments for this project
  const { data: transcriptRow } = await supabaseAdmin
    .from("transcripts")
    .select("segments")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!transcriptRow?.segments?.length) {
    return Response.json({ error: "No transcript found — process the project first" }, { status: 422 });
  }

  const rawSegs = transcriptRow.segments as Array<{ start: number; end: number; text: string }>;

  // Re-run highlights with options (custom prompt / count / duration)
  let segments;
  try {
    segments = await generateHighlights(
      formatSegmentsForHighlights(rawSegs),
      rawSegs,
      { count, prompt, targetDuration }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Highlights generation failed: ${msg}` }, { status: 500 });
  }

  if (segments.length === 0) {
    return Response.json({ error: "No highlights could be generated" }, { status: 422 });
  }

  // Deduplicate: remove existing clips before re-inserting
  await supabaseAdmin.from("clips").delete().eq("project_id", id);

  const insertPayload = segments.map((h) => ({
    project_id: id,
    title: h.clip_title ?? h.text.slice(0, 60),
    start_sec: h.start,
    end_sec: h.end,
    score: h.score ?? 50,
    score_reason: h.score_reason ?? null,
    hashtags: h.hashtags ?? [],
    clip_title: h.clip_title ?? h.text.slice(0, 60),
    topic: (h as { topic?: string }).topic ?? null,
    status: "pending",
    caption_style: "hormozi",
    aspect_ratio: "9:16",
  }));

  const { data: clips, error: insertError } = await supabaseAdmin
    .from("clips")
    .insert(insertPayload)
    .select();

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ clips }, { status: 201 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ownership = await resolveProjectOwnership(id, userId);
  if (ownership.error) return ownership.error;

  const { data: clips, error } = await supabaseAdmin
    .from("clips")
    .select("*")
    .eq("project_id", id)
    .order("score", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ clips: clips ?? [] }, { status: 200 });
}
