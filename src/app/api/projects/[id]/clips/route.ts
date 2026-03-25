/**
 * POST /api/projects/[id]/clips — trigger Inngest clips/generate job
 *   Body (optional): { count?: number, prompt?: string, targetDuration?: number }
 * GET  /api/projects/[id]/clips — list clips + topic_map for a project
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";
import { getSupabaseUserId } from "@/lib/user";

async function resolveProjectOwnership(
  projectId: string,
  clerkUserId: string
): Promise<
  { supabaseUserId: string; project: { id: string; user_id: string } } | { error: Response }
> {
  const supabaseUserId = await getSupabaseUserId(clerkUserId);
  if (!supabaseUserId)
    return { error: Response.json({ error: "Failed to resolve user" }, { status: 500 }) };

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (error || !project)
    return { error: Response.json({ error: "Project not found" }, { status: 404 }) };
  if (project.user_id !== supabaseUserId)
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };

  return { supabaseUserId, project };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await resolveProjectOwnership(id, userId);
  if ("error" in result) return result.error;

  // Verify transcript exists before firing job
  const { data: transcriptRow } = await supabaseAdmin
    .from("transcripts")
    .select("id")
    .eq("project_id", id)
    .limit(1)
    .single();

  if (!transcriptRow) {
    return Response.json(
      { error: "No transcript found — process the project first" },
      { status: 422 }
    );
  }

  // Parse generation options
  let count: number | undefined;
  let prompt: string | undefined;
  let targetDuration: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    count = body.count ? Number(body.count) : undefined;
    prompt = body.prompt?.trim() || undefined;
    targetDuration = body.targetDuration ? Number(body.targetDuration) : undefined;
  } catch {
    /* no body is fine */
  }

  // Mark clips as generating immediately (for UI)
  await supabaseAdmin.from("projects").update({ clips_status: "generating" }).eq("id", id);

  // Fire Inngest job — visible in dashboard, handles long Gemini calls
  await inngest.send({
    name: "clips/generate",
    data: { projectId: id, userId, count, prompt, targetDuration },
  });

  return Response.json({ status: "generating" }, { status: 202 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await resolveProjectOwnership(id, userId);
  if ("error" in result) return result.error;

  const [clipsRes, projectRes] = await Promise.all([
    supabaseAdmin
      .from("clips")
      .select("*")
      .eq("project_id", id)
      .order("score", { ascending: false }),
    supabaseAdmin
      .from("projects")
      .select("clips_status, topic_map, video_graph")
      .eq("id", id)
      .single(),
  ]);

  return Response.json(
    {
      clips: clipsRes.data ?? [],
      clips_status: projectRes.data?.clips_status ?? "idle",
      topic_map: projectRes.data?.topic_map ?? null,
      video_graph: projectRes.data?.video_graph ?? null,
    },
    { status: 200 }
  );
}
