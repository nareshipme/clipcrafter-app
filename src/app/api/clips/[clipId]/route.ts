/**
 * PATCH /api/clips/[clipId] — update status, caption_style, or aspect_ratio
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

const VALID_STATUSES = ["pending", "approved", "rejected", "exporting", "exported"] as const;
const VALID_CAPTION_STYLES = ["hormozi", "modern", "neon", "minimal"] as const;
const VALID_ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clipId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { clipId } = await params;

  // Fetch clip with project ownership info
  const { data: clip, error } = await supabaseAdmin
    .from("clips")
    .select("id, project_id, status, caption_style, aspect_ratio, projects(user_id)")
    .eq("id", clipId)
    .single();

  if (error || !clip) return Response.json({ error: "Clip not found" }, { status: 404 });

  type ClipRow = typeof clip & { projects: { user_id: string } | null };
  const typedClip = clip as ClipRow;
  if (typedClip.projects?.user_id !== supabaseUserId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const updates: Record<string, unknown> = {};

  if ("status" in body) {
    if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = body.status;
  }

  if ("caption_style" in body) {
    if (!VALID_CAPTION_STYLES.includes(body.caption_style as typeof VALID_CAPTION_STYLES[number])) {
      return Response.json(
        { error: `Invalid caption_style. Must be one of: ${VALID_CAPTION_STYLES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.caption_style = body.caption_style;
  }

  if ("aspect_ratio" in body) {
    if (!VALID_ASPECT_RATIOS.includes(body.aspect_ratio as typeof VALID_ASPECT_RATIOS[number])) {
      return Response.json(
        { error: `Invalid aspect_ratio. Must be one of: ${VALID_ASPECT_RATIOS.join(", ")}` },
        { status: 400 }
      );
    }
    updates.aspect_ratio = body.aspect_ratio;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("clips")
    .update(updates)
    .eq("id", clipId)
    .select()
    .single();

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  return Response.json({ clip: updated }, { status: 200 });
}
