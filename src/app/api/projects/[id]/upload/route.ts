import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getSupabaseUserId } from "@/lib/user";
import { Upload } from "@aws-sdk/lib-storage";
import { captureServerError } from "@/lib/posthog-server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min for large files

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

  // Filename + content-type come as headers — body is raw file stream
  const filename = request.headers.get("x-filename") ?? "upload.mp4";
  const contentType = request.headers.get("content-type") ?? "video/mp4";

  if (!request.body) {
    return Response.json({ error: "No file body" }, { status: 400 });
  }

  const key = await streamToR2(request.body, userId, filename, contentType);

  // Save r2_key to project
  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({ r2_key: key })
    .eq("id", id);

  if (updateError) {
    await captureServerError(updateError, {
      userId,
      supabaseUserId,
      route: "upload-project",
      projectId: id,
    });
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ key }, { status: 200 });
}

async function streamToR2(
  body: ReadableStream,
  userId: string,
  filename: string,
  contentType: string
): Promise<string> {
  const ext = filename.split(".").pop() ?? "mp4";
  const key = `uploads/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: body as unknown as ReadableStream,
      ContentType: contentType,
    },
  });
  await upload.done();
  return key;
}
