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

  // ── YouTube dedup: if a completed project exists for this URL, reuse its audio + transcript ──
  // A new project is still created (so highlights can differ), but we copy the existing
  // audio_key and transcript so we skip re-downloading and re-transcribing.
  let clonedAudioKey: string | null = null;
  let clonedTranscriptId: string | null = null;

  if (type === "youtube" && youtubeUrl) {
    const normalizedUrl = youtubeUrl.trim();
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select("id, audio_key")
      .eq("r2_key", normalizedUrl)
      .eq("status", "completed") // only reuse fully completed projects
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing?.audio_key) {
      clonedAudioKey = existing.audio_key;
      // Fetch the transcript too
      const { data: transcript } = await supabaseAdmin
        .from("transcripts")
        .select("id")
        .eq("project_id", existing.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (transcript) clonedTranscriptId = transcript.id;
    }
  }

  // If we have a cloned audio+transcript, skip straight to "transcribed" status
  const initialStatus = clonedTranscriptId ? "transcribed" : "pending";

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: supabaseUserId,
      title: title.trim(),
      type,
      status: initialStatus,
      ...(type === "youtube" && youtubeUrl ? { r2_key: youtubeUrl.trim() } : {}),
      ...(clonedAudioKey ? { audio_key: clonedAudioKey } : {}),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // If we cloned a transcript, copy its segments to the new project
  if (clonedTranscriptId && data) {
    const { data: srcTranscript } = await supabaseAdmin
      .from("transcripts")
      .select("segments")
      .eq("id", clonedTranscriptId)
      .single();
    if (srcTranscript) {
      await supabaseAdmin.from("transcripts").insert({
        project_id: data.id,
        segments: srcTranscript.segments,
      });
    }
  }

  return Response.json(
    {
      id: data.id,
      title: data.title,
      status: data.status,
      created_at: data.created_at,
      reused_transcript: !!clonedTranscriptId,
    },
    { status: 201 }
  );
}
