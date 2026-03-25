/**
 * POST /api/projects/[id]/clips/export-batch — queue multiple clip exports
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { inngest } from "@/lib/inngest";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { id: projectId } = await params;
  const body = (await request.json()) as { clipIds?: unknown; withCaptions?: unknown };
  const { clipIds, withCaptions } = body;

  if (!Array.isArray(clipIds) || clipIds.length === 0) {
    return Response.json({ error: "clipIds must be a non-empty array" }, { status: 400 });
  }

  // Verify project ownership
  const { data: project, error: projError } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (projError || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // Validate all clipIds belong to this project
  const { data: clips, error: clipsError } = await supabaseAdmin
    .from("clips")
    .select("id")
    .eq("project_id", projectId)
    .in("id", clipIds as string[]);

  if (clipsError) return Response.json({ error: clipsError.message }, { status: 500 });

  const validIds = (clips ?? []).map((c) => c.id);
  if (validIds.length === 0) {
    return Response.json({ error: "No valid clip IDs for this project" }, { status: 400 });
  }

  // Mark all as exporting
  await supabaseAdmin.from("clips").update({ status: "exporting" }).in("id", validIds);

  // Send one Inngest event per clip
  await Promise.all(
    validIds.map((clipId) =>
      inngest.send({
        name: "clipcrafter/clip.export",
        data: {
          clipId,
          projectId,
          userId: supabaseUserId,
          withCaptions: withCaptions === true,
        },
      })
    )
  );

  return Response.json({ queued: validIds.length }, { status: 202 });
}
