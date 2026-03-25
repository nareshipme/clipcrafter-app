/**
 * POST /api/clips/[clipId]/export — trigger Inngest clip export job
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { inngest } from "@/lib/inngest";

export async function POST(request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { clipId } = await params;

  let withCaptions = true;
  try {
    const body = (await request.json()) as { withCaptions?: unknown };
    if (typeof body.withCaptions === "boolean") withCaptions = body.withCaptions;
  } catch {
    // no body or non-JSON — use default
  }

  const { data: clip, error } = await supabaseAdmin
    .from("clips")
    .select(
      "id, project_id, status, start_sec, end_sec, caption_style, aspect_ratio, projects(user_id)"
    )
    .eq("id", clipId)
    .single();

  if (error || !clip) return Response.json({ error: "Clip not found" }, { status: 404 });

  type ClipRow = typeof clip & { projects: { user_id: string } | null };
  const typedClip = clip as ClipRow;
  if (typedClip.projects?.user_id !== supabaseUserId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Set status to exporting
  await supabaseAdmin.from("clips").update({ status: "exporting" }).eq("id", clipId);

  // Dispatch Inngest job
  await inngest.send({
    name: "clipcrafter/clip.export",
    data: {
      clipId,
      projectId: clip.project_id,
      userId: supabaseUserId,
      withCaptions,
    },
  });

  return Response.json({ status: "exporting", clipId }, { status: 202 });
}
