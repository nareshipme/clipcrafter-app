import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) {
    return Response.json({ error: "Failed to resolve user" }, { status: 500 });
  }

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, status, error_message, completed_at")
    .eq("id", id)
    .single();

  if (error || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== supabaseUserId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Include transcript + highlights when completed
  let transcript = null;
  let highlights = null;

  if (project.status === "completed") {
    const [tResult, hResult] = await Promise.all([
      supabaseAdmin
        .from("transcripts")
        .select("id, segments")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      supabaseAdmin
        .from("highlights")
        .select("id, segments")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);
    if (tResult.data) transcript = tResult.data;
    if (hResult.data) highlights = hResult.data;
  }

  return Response.json(
    {
      id: project.id,
      status: project.status,
      error_message: project.error_message ?? null,
      completed_at: project.completed_at ?? null,
      transcript,
      highlights,
    },
    { status: 200 }
  );
}
