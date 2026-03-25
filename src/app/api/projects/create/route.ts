import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

/**
 * Normalize a YouTube URL to a canonical video ID form: https://www.youtube.com/watch?v=ID
 * This ensures youtu.be/ID, youtube.com/live/ID, and full URLs all match the same stored key.
 */
function normalizeYouTubeUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
  return url; // fallback: store as-is
}

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

  const { title, type, youtubeUrl } = body as {
    title?: string;
    type?: string;
    youtubeUrl?: string;
  };

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

  // ── YouTube dedup: if any project already exists for this URL, return it ──
  if (type === "youtube" && youtubeUrl) {
    const normalizedUrl = normalizeYouTubeUrl(youtubeUrl.trim());
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select("id, status")
      .eq("user_id", supabaseUserId)
      .eq("r2_key", normalizedUrl)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return Response.json(
        { id: existing.id, status: existing.status, deduplicated: true },
        { status: 200 }
      );
    }
  }

  const initialStatus = "pending";

  const normalizedYouTubeUrl =
    type === "youtube" && youtubeUrl ? normalizeYouTubeUrl(youtubeUrl.trim()) : undefined;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: supabaseUserId,
      title: title.trim(),
      type,
      status: initialStatus,
      ...(normalizedYouTubeUrl ? { r2_key: normalizedYouTubeUrl } : {}),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    {
      id: data.id,
      title: data.title,
      status: data.status,
      created_at: data.created_at,
      deduplicated: false,
    },
    { status: 201 }
  );
}
