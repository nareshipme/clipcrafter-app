import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, type, youtubeUrl } = body as { title?: string; type?: string; youtubeUrl?: string };

  if (!title || typeof title !== "string" || title.trim() === "") {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (type !== "upload" && type !== "youtube") {
    return Response.json({ error: 'type must be "upload" or "youtube"' }, { status: 400 });
  }
  if (type === "youtube" && !youtubeUrl) {
    return Response.json({ error: "youtubeUrl is required for type=youtube" }, { status: 400 });
  }

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) {
    return Response.json({ error: "Failed to resolve user" }, { status: 500 });
  }

  // ── YouTube dedup: if a completed project already exists for this URL, return it ──
  if (type === "youtube" && youtubeUrl) {
    const normalizedUrl = youtubeUrl.trim();
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select("id, title, status, created_at")
      .eq("r2_key", normalizedUrl)
      .eq("user_id", supabaseUserId)
      .in("status", ["completed", "processing", "extracting_audio", "transcribing", "generating_highlights"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return Response.json(
        {
          id: existing.id,
          title: existing.title,
          status: existing.status,
          created_at: existing.created_at,
          deduplicated: true,
          message: existing.status === "completed"
            ? "This YouTube URL has already been transcribed. Returning existing project."
            : "This YouTube URL is currently being processed.",
        },
        { status: 200 } // 200 not 201 — existing resource
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: supabaseUserId,
      title: title.trim(),
      type,
      status: "pending",
      ...(type === "youtube" && youtubeUrl ? { r2_key: youtubeUrl.trim() } : {}),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    { id: data.id, title: data.title, status: data.status, created_at: data.created_at },
    { status: 201 }
  );
}
