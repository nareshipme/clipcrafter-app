/**
 * Highlights generation
 *
 * ONE PASS: transcript → topic-segmented map
 *   - Send transcript ONCE to Gemini
 *   - Get back: topics, each with their best clip timestamp + all relevant segments
 *   - No per-topic Gemini calls, no transcript repetition
 *
 * MANUAL: transcript → N best clips (when user picks a count or search prompt)
 */

export interface Highlight {
  start: number;
  end: number;
  text: string;
  reason: string;
  score: number;
  score_reason: string;
  hashtags: string[];
  clip_title: string;
  topic?: string;
}

export interface TopicSegment {
  start: number;
  end: number;
  text: string;
}

export interface TopicMap {
  topic: string;
  summary: string;
  clip_start: number; // best clip start (MM:SS parsed)
  clip_end: number; // best clip end
  segments: TopicSegment[]; // all transcript segments under this topic
}

export interface TranscriptSegmentInput {
  start: number;
  end: number;
  text: string;
}

export interface HighlightOptions {
  count?: number; // if set: manual N-clip mode; if unset: auto topic mode
  prompt?: string; // search filter within auto mode
  targetDuration?: number; // total seconds constraint (manual mode)
}

/** Format segments as [MM:SS] lines */
export function formatSegmentsForHighlights(segments: TranscriptSegmentInput[]): string {
  return segments
    .map((s) => {
      const mm = Math.floor(s.start / 60)
        .toString()
        .padStart(2, "0");
      const ss = Math.floor(s.start % 60)
        .toString()
        .padStart(2, "0");
      return `[${mm}:${ss}] ${s.text}`;
    })
    .join("\n");
}

/**
 * For very long transcripts (>15K chars), thin it to keep only every Nth segment
 * so the prompt fits comfortably and Gemini doesn't time out.
 * The timestamps are preserved so clip extraction is still accurate.
 */
export function thinTranscript(formatted: string, maxChars = 15_000): string {
  if (formatted.length <= maxChars) return formatted;
  const lines = formatted.split("\n").filter(Boolean);
  // Progressively skip more lines until under limit
  for (let step = 2; step <= 6; step++) {
    const thinned = lines.filter((_, i) => i % step === 0).join("\n");
    if (thinned.length <= maxChars) {
      console.log(
        `[highlights] transcript thinned (1 of every ${step} segments, ${thinned.length} chars)`
      );
      return thinned;
    }
  }
  // Last resort: hard truncate at char limit with a note
  console.warn(`[highlights] transcript hard-truncated to ${maxChars} chars`);
  return formatted.slice(0, maxChars);
}

/** Parse "MM:SS" → seconds */
function parseMMSS(str: string): number {
  const parts = str.trim().split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

import { callLLM, parseLLMJson } from "@/lib/llm";

// ─── Auto mode: ONE-PASS topic map ───────────────────────────────────────────

const TOPIC_MAP_PROMPT = (
  transcript: string
) => `You are an expert video editor analyzing a transcript.

Transcript (format: [MM:SS] text):
${transcript}

Task: Identify every distinct topic/theme the speaker covers. For each topic:
1. Name it clearly (3-6 words)
2. Write a 1-sentence summary
3. Find the single best 30-90 second clip for social media (use timestamps from the transcript)
4. List the timestamp ranges of ALL segments relevant to that topic

Return ONLY valid JSON, no markdown:
[
  {
    "topic": "short topic name",
    "summary": "one sentence summary",
    "clip_start": "MM:SS",
    "clip_end": "MM:SS",
    "segments": [
      { "start": "MM:SS", "end": "MM:SS", "text": "transcript text for this segment" }
    ]
  }
]

Rules:
- Use ONLY timestamps that appear in the transcript
- Each segment should be a complete thought (one transcript line or a few consecutive lines)
- clip_start/clip_end must be within the segment list for that topic
- Do not repeat segments across topics`;

export async function buildTopicMap(
  formattedTranscript: string,
  _rawSegments: TranscriptSegmentInput[]
): Promise<TopicMap[]> {
  console.log("Building topic map (one-pass)...");
  const raw = await callLLM(TOPIC_MAP_PROMPT(formattedTranscript));

  let parsed: Array<{
    topic: string;
    summary: string;
    clip_start: string;
    clip_end: string;
    segments: Array<{ start: string; end: string; text: string }>;
  }>;

  try {
    parsed = parseLLMJson(raw);
  } catch {
    console.error("Topic map JSON parse failed, raw:", raw.slice(0, 200));
    throw new Error("Failed to parse topic map from LLM");
  }

  return parsed
    .filter((t) => t.topic && t.clip_start && t.clip_end)
    .map((t) => ({
      topic: t.topic,
      summary: t.summary ?? "",
      clip_start: parseMMSS(t.clip_start),
      clip_end: parseMMSS(t.clip_end),
      segments: (t.segments ?? [])
        .map((s) => ({
          start: parseMMSS(s.start),
          end: parseMMSS(s.end),
          text: s.text ?? "",
        }))
        .filter((s) => !isNaN(s.start) && !isNaN(s.end)),
    }))
    .filter((t) => !isNaN(t.clip_start) && !isNaN(t.clip_end) && t.clip_end > t.clip_start);
}

// ─── Convert TopicMap → Highlights (with enrichment) ─────────────────────────

const ENRICH_PROMPT = (clips: Array<{ start: number; end: number; text: string; topic: string }>) =>
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

async function enrichClips(
  clips: Array<{ start: number; end: number; text: string; topic: string }>
): Promise<
  Array<{
    score: number;
    score_reason: string;
    reason: string;
    hashtags: string[];
    clip_title: string;
  }>
> {
  const raw = await callLLM(ENRICH_PROMPT(clips));
  return parseLLMJson(raw);
}

// ─── Auto highlights from topic map ──────────────────────────────────────────

export async function generateAutoHighlights(
  formattedTranscript: string,
  rawSegments: TranscriptSegmentInput[]
): Promise<Highlight[]> {
  const topicMap = await buildTopicMap(formattedTranscript, rawSegments);
  console.log(`Topic map built: ${topicMap.length} topics`);

  if (topicMap.length === 0) {
    console.warn("Empty topic map, falling back to 5-clip manual mode");
    return generateHighlights(formattedTranscript, rawSegments, { count: 5 });
  }

  const clips = topicMap.map((t) => {
    const text = rawSegments
      .filter((s) => s.end > t.clip_start && s.start < t.clip_end)
      .map((s) => s.text)
      .join(" ")
      .trim();
    return { start: t.clip_start, end: t.clip_end, text, topic: t.topic };
  });

  let enriched: ReturnType<typeof enrichClips> extends Promise<infer T> ? T : never;
  try {
    enriched = await enrichClips(clips);
  } catch {
    enriched = clips.map(() => ({
      score: 50,
      score_reason: "",
      reason: "",
      hashtags: [],
      clip_title: "",
    }));
  }

  return clips.map((c, i) => ({
    ...c,
    reason: enriched[i]?.reason ?? "",
    score: enriched[i]?.score ?? 50,
    score_reason: enriched[i]?.score_reason ?? "",
    hashtags: enriched[i]?.hashtags ?? [],
    clip_title: enriched[i]?.clip_title ?? "",
  }));
}

// ─── Manual mode: N clips ─────────────────────────────────────────────────────

const FIND_SEGMENTS_PROMPT = (transcript: string, opts: HighlightOptions = {}) => {
  const count = opts.count ?? 5;
  const instruction = opts.prompt
    ? `Instruction: Identify ${count} segments that directly answer, discuss, or relate to this topic: "${opts.prompt}".`
    : `Instruction: Identify the ${count} most impactful, emotionally resonant, and engaging highlight moments.`;
  const constraint = opts.targetDuration
    ? `\nConstraint: Select segments whose combined total duration is approximately ${opts.targetDuration} seconds.`
    : "";

  return `You are an expert video editor.

Transcript ([MM:SS] format):
${transcript}

${instruction}${constraint}

Return ONLY time pairs, one per line: MM:SS, MM:SS
Example:
00:10, 00:25
01:05, 01:20

Rules: use only timestamps from the transcript. No explanation.`;
};

async function findTimeRanges(
  transcript: string,
  opts?: HighlightOptions
): Promise<Array<{ start: number; end: number }>> {
  const raw = await callLLM(FIND_SEGMENTS_PROMPT(transcript, opts));
  const results: Array<{ start: number; end: number }> = [];
  const linePattern = /(\d{1,2}:\d{2})\s*,\s*(\d{1,2}:\d{2})/g;
  let match;
  while ((match = linePattern.exec(raw)) !== null) {
    const start = parseMMSS(match[1]);
    const end = parseMMSS(match[2]);
    if (!isNaN(start) && !isNaN(end) && end > start) results.push({ start, end });
  }
  return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateHighlights(
  formattedTranscript: string,
  rawSegments?: TranscriptSegmentInput[],
  opts?: HighlightOptions
): Promise<Highlight[]> {
  if (!formattedTranscript) throw new Error("transcript is required");

  // Auto mode — one-pass topic map
  if (!opts?.count && !opts?.prompt) {
    return generateAutoHighlights(formattedTranscript, rawSegments ?? []);
  }

  // Manual mode
  const timeRanges = await findTimeRanges(formattedTranscript, opts);
  if (timeRanges.length === 0) return [];

  const segmentsWithText = timeRanges.map(({ start, end }) => {
    const text =
      rawSegments
        ?.filter((s) => s.end > start && s.start < end)
        .map((s) => s.text)
        .join(" ")
        .trim() ?? "";
    return { start, end, text, topic: undefined as string | undefined };
  });

  let enriched: Array<{
    score: number;
    score_reason: string;
    reason: string;
    hashtags: string[];
    clip_title: string;
  }>;
  try {
    enriched = await enrichClips(segmentsWithText.map((s) => ({ ...s, topic: "" })));
  } catch {
    enriched = segmentsWithText.map(() => ({
      score: 50,
      score_reason: "",
      reason: "",
      hashtags: [],
      clip_title: "",
    }));
  }

  return segmentsWithText.map((seg, i) => ({
    ...seg,
    reason: enriched[i]?.reason ?? "",
    score: enriched[i]?.score ?? 50,
    score_reason: enriched[i]?.score_reason ?? "",
    hashtags: enriched[i]?.hashtags ?? [],
    clip_title: enriched[i]?.clip_title ?? "",
  }));
}

// ─── Post-save enrichment ─────────────────────────────────────────────────────

/**
 * Enrich saved clips with score_reason + hashtags after they've been inserted.
 * Called as a non-fatal background step in the Inngest pipeline.
 */
export async function enrichClipsForProject(
  projectId: string,
  _segments: Array<{ id: string; start: number; end: number; topicId?: string }>,
  rawSegments: TranscriptSegmentInput[]
): Promise<void> {
  const { supabaseAdmin } = await import("@/lib/supabase");

  // Fetch saved clips to get their IDs and topics
  const { data: clips } = await supabaseAdmin
    .from("clips")
    .select("id, start_sec, end_sec, topic, clip_title")
    .eq("project_id", projectId);

  if (!clips?.length) return;

  const clipsForEnrich = clips.map((c) => ({
    start: c.start_sec,
    end: c.end_sec,
    text: rawSegments
      .filter((s) => s.end > c.start_sec && s.start < c.end_sec)
      .map((s) => s.text)
      .join(" ")
      .trim(),
    topic: c.topic ?? "",
  }));

  const enriched = await enrichClips(clipsForEnrich);

  // Update each clip with enrichment data
  await Promise.all(
    clips.map((clip, i) =>
      supabaseAdmin
        .from("clips")
        .update({
          score: enriched[i]?.score ?? 50,
          score_reason: enriched[i]?.score_reason ?? null,
          hashtags: enriched[i]?.hashtags ?? [],
          clip_title: clip.clip_title || enriched[i]?.clip_title || null,
        })
        .eq("id", clip.id)
    )
  );

  console.log(`[highlights] enriched ${clips.length} clips for project ${projectId}`);
}
