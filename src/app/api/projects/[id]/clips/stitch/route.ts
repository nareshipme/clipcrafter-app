/**
 * POST /api/projects/[id]/clips/stitch — queue a stitch-and-export job
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { inngest } from "@/lib/inngest";

function validateStitchBody(body: { clipIds?: unknown; withCaptions?: unknown }): string | null {
  if (!Array.isArray(body.clipIds) || body.clipIds.length < 2) {
    return "clipIds must be an array of at least 2 clip IDs";
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { id: projectId } = await params;
  const body = (await request.json()) as { clipIds?: unknown; withCaptions?: unknown };

  const validationError = validateStitchBody(body);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  const clipIds = body.clipIds as string[];
  const withCaptions = body.withCaptions === true;

  // Verify project ownership
  const { data: project, error: projError } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (projError || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // Validate clip IDs belong to this project
  const { data: clips, error: clipsError } = await supabaseAdmin
    .from("clips")
    .select("id")
    .eq("project_id", projectId)
    .in("id", clipIds);

  if (clipsError) return Response.json({ error: clipsError.message }, { status: 500 });

  const validIds = (clips ?? []).map((c) => c.id);
  if (validIds.length < 2) {
    return Response.json(
      { error: "Need at least 2 valid clip IDs for this project" },
      { status: 400 }
    );
  }

  const result = await inngest.send({
    name: "clipcrafter/clips.stitch",
    data: { projectId, clipIds: validIds, withCaptions },
  });

  return Response.json({ jobId: result.ids[0] }, { status: 202 });
}
