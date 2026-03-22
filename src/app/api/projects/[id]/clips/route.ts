/**
 * POST /api/projects/[id]/clips — generate clip rows from highlights
 * GET  /api/projects/[id]/clips — list all clips for a project
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

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

  // Fetch the latest highlights for this project
  const { data: highlightRow, error: hlError } = await supabaseAdmin
    .from("highlights")
    .select("id, segments")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (hlError || !highlightRow) {
    return Response.json({ error: "No highlights found — process the project first" }, { status: 422 });
  }

  type HighlightSegment = {
    start: number;
    end: number;
    text: string;
    score?: number;
    score_reason?: string;
    hashtags?: string[];
    clip_title?: string;
  };

  const segments = (highlightRow.segments as HighlightSegment[]) ?? [];

  const insertPayload = segments.map((h) => ({
    project_id: id,
    title: h.text,
    start_sec: h.start,
    end_sec: h.end,
    score: h.score ?? 0,
    score_reason: h.score_reason ?? null,
    hashtags: h.hashtags ?? [],
    clip_title: h.clip_title ?? null,
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
