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
  clip_end: number;   // best clip end
  segments: TopicSegment[]; // all transcript segments under this topic
}

export interface TranscriptSegmentInput {
  start: number;
  end: number;
  text: string;
}

export interface HighlightOptions {
  count?: number;          // if set: manual N-clip mode; if unset: auto topic mode
  prompt?: string;         // search filter within auto mode
  targetDuration?: number; // total seconds constraint (manual mode)
}

/** Format segments as [MM:SS] lines */
export function formatSegmentsForHighlights(segments: TranscriptSegmentInput[]): string {
  return segments
    .map(s => {
      const mm = Math.floor(s.start / 60).toString().padStart(2, "0");
      const ss = Math.floor(s.start % 60).toString().padStart(2, "0");
      return `[${mm}:${ss}] ${s.text}`;
    })
    .join("\n");
}

/** Parse "MM:SS" → seconds */
function parseMMSS(str: string): number {
  const parts = str.trim().split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

async function getGeminiModel(preferFast = true) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const models = preferFast
    ? ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite"]
    : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  return { genAI, models: [...new Set([process.env.GEMINI_MODEL, ...models].filter(Boolean) as string[])] };
}

async function callGemini(prompt: string, preferFast = true): Promise<string> {
  const { genAI, models } = await getGeminiModel(preferFast);
  let lastErr: Error | null = null;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text() ?? "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = msg.includes("deprecated") || msg.includes("not found") || msg.includes("404") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      console.warn(`Gemini model "${modelName}" failed: ${msg}`);
      lastErr = err instanceof Error ? err : new Error(msg);
      if (!retryable) throw lastErr;
    }
  }
  throw lastErr ?? new Error("All Gemini models failed");
}

// ─── Auto mode: ONE-PASS topic map ───────────────────────────────────────────

const TOPIC_MAP_PROMPT = (transcript: string) => `You are an expert video editor analyzing a transcript.

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
  rawSegments: TranscriptSegmentInput[]
): Promise<TopicMap[]> {
  console.log("Building topic map (one-pass)...");
  const raw = await callGemini(TOPIC_MAP_PROMPT(formattedTranscript));
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  let parsed: Array<{
    topic: string;
    summary: string;
    clip_start: string;
    clip_end: string;
    segments: Array<{ start: string; end: string; text: string }>;
  }>;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Topic map JSON parse failed, raw:", cleaned.slice(0, 200));
    throw new Error("Failed to parse topic map from Gemini");
  }

  return parsed
    .filter(t => t.topic && t.clip_start && t.clip_end)
    .map(t => ({
      topic: t.topic,
      summary: t.summary ?? "",
      clip_start: parseMMSS(t.clip_start),
      clip_end: parseMMSS(t.clip_end),
      segments: (t.segments ?? []).map(s => ({
        start: parseMMSS(s.start),
        end: parseMMSS(s.end),
        text: s.text ?? "",
      })).filter(s => !isNaN(s.start) && !isNaN(s.end)),
    }))
    .filter(t => !isNaN(t.clip_start) && !isNaN(t.clip_end) && t.clip_end > t.clip_start);
}

// ─── Convert TopicMap → Highlights (with enrichment) ─────────────────────────

const ENRICH_PROMPT = (clips: Array<{ start: number; end: number; text: string; topic: string }>) => `
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
${clips.map((c, i) => `${i + 1}. [${Math.floor(c.start / 60).toString().padStart(2, "0")}:${Math.floor(c.start % 60).toString().padStart(2, "0")} → ${Math.floor(c.end / 60).toString().padStart(2, "0")}:${Math.floor(c.end % 60).toString().padStart(2, "0")}] Topic: ${c.topic}\n   ${c.text}`).join("\n\n")}
`.trim();

async function enrichClips(
  clips: Array<{ start: number; end: number; text: string; topic: string }>
): Promise<Array<{ score: number; score_reason: string; reason: string; hashtags: string[]; clip_title: string }>> {
  const raw = await callGemini(ENRICH_PROMPT(clips), false);
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
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

  const clips = topicMap.map(t => {
    const text = rawSegments
      .filter(s => s.end > t.clip_start && s.start < t.clip_end)
      .map(s => s.text).join(" ").trim();
    return { start: t.clip_start, end: t.clip_end, text, topic: t.topic };
  });

  let enriched: ReturnType<typeof enrichClips> extends Promise<infer T> ? T : never;
  try {
    enriched = await enrichClips(clips);
  } catch {
    enriched = clips.map(() => ({ score: 50, score_reason: "", reason: "", hashtags: [], clip_title: "" }));
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

async function findTimeRanges(transcript: string, opts?: HighlightOptions): Promise<Array<{ start: number; end: number }>> {
  const raw = await callGemini(FIND_SEGMENTS_PROMPT(transcript, opts));
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
    const text = rawSegments
      ?.filter(s => s.end > start && s.start < end)
      .map(s => s.text).join(" ").trim() ?? "";
    return { start, end, text, topic: undefined as string | undefined };
  });

  let enriched: Array<{ score: number; score_reason: string; reason: string; hashtags: string[]; clip_title: string }>;
  try {
    enriched = await enrichClips(segmentsWithText.map(s => ({ ...s, topic: "" })));
  } catch {
    enriched = segmentsWithText.map(() => ({ score: 50, score_reason: "", reason: "", hashtags: [], clip_title: "" }));
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
