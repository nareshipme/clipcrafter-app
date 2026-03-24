import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPresignedUploadUrl } from "@/lib/r2";
import { getSupabaseUserId } from "@/lib/user";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (error || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== supabaseUserId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { filename } = body as {
    filename?: string;
    contentType?: string;
  };

  if (!filename) {
    return Response.json({ error: "filename is required" }, { status: 400 });
  }

  const { uploadUrl, key } = await getPresignedUploadUrl(filename, userId);

  return Response.json({ uploadUrl, key }, { status: 200 });
}
