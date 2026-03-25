import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

/**
 * Normalize a YouTube URL to a canonical video ID form: https://www.youtube.com/watch?v=ID
 * This ensures youtu.be/ID, youtube.com/live/ID, /shorts/, and full watch URLs all
 * map to the same stored key for deduplication purposes.
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

  const normalizedYouTubeUrl =
    type === "youtube" && youtubeUrl ? normalizeYouTubeUrl(youtubeUrl.trim()) : undefined;

  // ── YouTube asset reuse ──
  // If the user already has a *completed* project for this URL, reuse its audio + transcript.
  // A new project is always created (user may want different clip selections), but we skip
  // re-downloading and re-transcribing by copying the existing audio_key + transcript segments
  // and setting status="transcribed" so the Inngest job jumps straight to highlight generation.
  let reusedAudioKey: string | null = null;
  let reusedTranscriptSegments: unknown | null = null;

  if (normalizedYouTubeUrl) {
    const { data: source } = await supabaseAdmin
      .from("projects")
      .select("id, audio_key")
      .eq("user_id", supabaseUserId)
      .eq("r2_key", normalizedYouTubeUrl)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (source?.audio_key) {
      reusedAudioKey = source.audio_key;
      const { data: transcript } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", source.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (transcript) reusedTranscriptSegments = transcript.segments;
    }
  }

  const initialStatus = reusedTranscriptSegments ? "transcribed" : "pending";

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: supabaseUserId,
      title: title.trim(),
      type,
      status: initialStatus,
      ...(normalizedYouTubeUrl ? { r2_key: normalizedYouTubeUrl } : {}),
      ...(reusedAudioKey ? { audio_key: reusedAudioKey } : {}),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Copy transcript segments to the new project so the Inngest job can skip transcription
  if (reusedTranscriptSegments && data) {
    await supabaseAdmin.from("transcripts").insert({
      project_id: data.id,
      segments: reusedTranscriptSegments,
    });
  }

  return Response.json(
    {
      id: data.id,
      title: data.title,
      status: data.status,
      created_at: data.created_at,
      reused_assets: !!reusedTranscriptSegments,
    },
    { status: 201 }
  );
}
