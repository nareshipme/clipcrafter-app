/**
 * POST /api/projects/[id]/clips/from-segments
 * Body: { segments: Array<{ start: number; end: number; text: string; topic: string }> }
 * Enriches each segment with LLM metadata and inserts as clips (upsert by start_sec).
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { callLLM, parseLLMJson } from "@/lib/llm";
import { getSupabaseUserId } from "@/lib/user";

interface SegmentInput {
  start: number;
  end: number;
  text: string;
  topic: string;
}

const ENRICH_PROMPT = (clips: SegmentInput[]) =>
  `
You are a social media content strategist.

For each video clip, provide engagement metadata:
- score: 0-100 (hook strength, emotional punch, quotability, actionability)
- score_reason: one sentence
- reason: why this moment is highlight-worthy
- hashtags: 3-5 relevant hashtags (no # symbol)
- clip_title: punchy 5-8 word title

Return ONLY a JSON array (one object per clip, same order). No markdown.
[{ "score": int, "score_reason": str, "reason": str, "hashtags": [str], "clip_title": str }]

Clips:
${clips
  .map(
    (c, i) =>
      `${i + 1}. [${Math.floor(c.start / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(c.start % 60)
        .toString()
        .padStart(2, "0")} → ${Math.floor(c.end / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(c.end % 60)
        .toString()
        .padStart(2, "0")}] Topic: ${c.topic}\n   ${c.text}`
  )
  .join("\n\n")}
`.trim();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project)
    return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { segments?: SegmentInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const segments = body.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    return Response.json({ error: "segments array is required" }, { status: 400 });
  }

  // Enrich with LLM
  let enriched: Array<{
    score: number;
    score_reason: string;
    reason: string;
    hashtags: string[];
    clip_title: string;
  }>;
  try {
    const raw = await callLLM(ENRICH_PROMPT(segments));
    enriched = parseLLMJson(raw);
  } catch {
    enriched = segments.map(() => ({
      score: 50,
      score_reason: "",
      reason: "",
      hashtags: [],
      clip_title: "",
    }));
  }

  const insertPayload = segments.map((seg, i) => ({
    project_id: projectId,
    title: enriched[i]?.clip_title || seg.text.slice(0, 60),
    start_sec: seg.start,
    end_sec: seg.end,
    score: enriched[i]?.score ?? 50,
    score_reason: enriched[i]?.score_reason ?? null,
    hashtags: enriched[i]?.hashtags ?? [],
    clip_title: enriched[i]?.clip_title || null,
    topic: seg.topic || null,
    status: "pending",
    caption_style: "hormozi",
    aspect_ratio: "9:16",
  }));

  // Upsert by (project_id, start_sec) to avoid dupes
  const { data: clips, error: insertError } = await supabaseAdmin
    .from("clips")
    .upsert(insertPayload, { onConflict: "project_id,start_sec", ignoreDuplicates: false })
    .select();

  if (insertError) {
    console.error("[from-segments] upsert error:", insertError);
    return Response.json({ error: "Failed to insert clips" }, { status: 500 });
  }

  return Response.json({ clips: clips ?? [] }, { status: 200 });
}
