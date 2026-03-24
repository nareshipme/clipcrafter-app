import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";
import { getSupabaseUserId } from "@/lib/user";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, user_id, r2_key")
    .eq("id", id)
    .single();

  if (error || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== supabaseUserId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({ status: "processing" })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await inngest.send({
    name: "video/process",
    data: { projectId: id, r2Key: project.r2_key, userId },
  });

  return Response.json({ status: "processing" }, { status: 200 });
}
