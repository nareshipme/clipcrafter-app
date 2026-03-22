/**
 * Highlights generation — two modes:
 *
 * MANUAL (count=N): two-pass
 *   Pass 1: transcript → N "MM:SS, MM:SS" ranges
 *   Pass 2: enrich each with score/hashtags/title
 *
 * AUTO (count=undefined): topic-first three-pass
 *   Pass 1: transcript → discover distinct topics the speaker covers
 *   Pass 2: per topic → find best 30-90s clip (parallel)
 *   Pass 3: enrich each clip
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
  topic?: string; // only set in auto mode
}

export interface TranscriptSegmentInput {
  start: number;
  end: number;
  text: string;
}

/**
 * Format segments as [MM:SS] lines — the same format the old toolnexus used.
 * Gemini is very reliable at picking timestamps back out of this format.
 */
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

// ─── Pass 1: find time ranges ─────────────────────────────────────────────────

export interface HighlightOptions {
  count?: number;          // number of highlights. undefined = Auto (topic-first)
  prompt?: string;         // custom search query, e.g. "moments about AI"
  targetDuration?: number; // total combined duration in seconds, e.g. 60
}

const FIND_SEGMENTS_PROMPT = (transcript: string, opts: HighlightOptions = {}) => {
  const count = opts.count ?? 5;
  const instruction = opts.prompt
    ? `Instruction: Identify ${count} segments that directly answer, discuss, or relate to this topic: "${opts.prompt}".`
    : `Instruction: Identify the ${count} most impactful, emotionally resonant, and engaging highlight moments.`;
  const constraint = opts.targetDuration
    ? `\nConstraint: Select segments whose combined total duration is approximately ${opts.targetDuration} seconds.`
    : "";

  return `You are an expert video editor and storyteller.

You are given a timestamped transcript. Each line is formatted as [MM:SS] text.

Transcript:
${transcript}

${instruction}${constraint}

Output Format: Return ONLY a list of time segments in 'MM:SS, MM:SS' format (start, end per line).
Example:
00:10, 00:25
01:05, 01:20

Rules:
- Use timestamps that appear in the transcript directly — do not invent timestamps.
- Each segment should be a coherent, self-contained moment (minimum 5 seconds).
- Do not include any explanation, just the list of time pairs.`;
};

// ─── Pass 2: enrich each segment ─────────────────────────────────────────────

const ENRICH_PROMPT = (segments: Array<{ start: number; end: number; text: string }>) => `
You are a social media content strategist.

For each video clip below, provide:
- score: engagement score 0-100 (hook strength, emotional punch, quotability, actionability)
- score_reason: one sentence justification
- reason: why this moment is highlight-worthy
- hashtags: 3-5 relevant hashtags (no # symbol)
- clip_title: punchy 5-8 word title

Return ONLY a valid JSON array, one object per clip, in the same order. No markdown.
[{
  "score": <integer 0-100>,
  "score_reason": "<one sentence>",
  "reason": "<why engaging>",
  "hashtags": ["tag1", "tag2", "tag3"],
  "clip_title": "<punchy title>"
}]

Clips:
${segments.map((s, i) => `${i + 1}. [${Math.floor(s.start / 60).toString().padStart(2, "0")}:${Math.floor(s.start % 60).toString().padStart(2, "0")} → ${Math.floor(s.end / 60).toString().padStart(2, "0")}:${Math.floor(s.end % 60).toString().padStart(2, "0")}] ${s.text}`).join("\n")}
`.trim();

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateHighlights(
  formattedTranscript: string,
  rawSegments?: TranscriptSegmentInput[],
  opts?: HighlightOptions
): Promise<Highlight[]> {
  if (!formattedTranscript) throw new Error("transcript is required");

  // Auto mode — topic-first pipeline
  if (opts?.count === undefined && !opts?.prompt) {
    return generateAutoHighlights(formattedTranscript, rawSegments);
  }

  // Manual mode — fixed count
  const timeRanges = await findTimeRanges(formattedTranscript, opts);

  if (timeRanges.length === 0) {
    console.warn("Highlights pass 1 returned no segments");
    return [];
  }

  // Resolve text for each segment from rawSegments if available,
  // otherwise extract from the formatted transcript string
  const segmentsWithText = timeRanges.map(({ start, end }) => {
    let text = "";
    if (rawSegments) {
      // Collect all raw segments that overlap with this time range
      text = rawSegments
        .filter(s => s.end > start && s.start < end)
        .map(s => s.text)
        .join(" ")
        .trim();
    }
    if (!text) {
      // Fallback: extract lines from formatted transcript within range
      text = formattedTranscript
        .split("\n")
        .filter(line => {
          const m = line.match(/^\[(\d{2}):(\d{2})\]/);
          if (!m) return false;
          const t = parseInt(m[1]) * 60 + parseInt(m[2]);
          return t >= start && t <= end;
        })
        .map(line => line.replace(/^\[\d{2}:\d{2}\]\s*/, ""))
        .join(" ")
        .trim();
    }
    return { start, end, text };
  });

  // Pass 2: enrich with score/reason/hashtags/clip_title
  let enriched: Array<{ score: number; score_reason: string; reason: string; hashtags: string[]; clip_title: string }>;
  try {
    enriched = await enrichSegments(segmentsWithText);
  } catch (err) {
    console.warn("Highlights enrichment failed, using defaults:", err);
    enriched = segmentsWithText.map(() => ({
      score: 50,
      score_reason: "Score unavailable",
      reason: "Highlighted segment",
      hashtags: [],
      clip_title: "",
    }));
  }

  return segmentsWithText.map((seg, i) => ({
    ...seg,
    ...(enriched[i] ?? { score: 50, score_reason: "", reason: "", hashtags: [], clip_title: "" }),
  }));
}

// ─── Pass 1 impl ─────────────────────────────────────────────────────────────

async function findTimeRanges(transcript: string, opts?: HighlightOptions): Promise<Array<{ start: number; end: number }>> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const models = [
    process.env.GEMINI_MODEL,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
  ].filter(Boolean) as string[];

  let raw = "";
  for (const modelName of [...new Set(models)]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(FIND_SEGMENTS_PROMPT(transcript, opts));
      raw = result.response.text() ?? "";
      console.log(`Highlights pass 1 done with model: ${modelName}`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = msg.includes("deprecated") || msg.includes("not found") || msg.includes("404") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      console.warn(`Highlights pass 1 model "${modelName}" failed: ${msg}`);
      if (!isRetryable) throw err;
    }
  }

  if (!raw) throw new Error("All Gemini models failed for highlights pass 1");

  // Parse "MM:SS, MM:SS" lines
  const results: Array<{ start: number; end: number }> = [];
  const linePattern = /(\d{1,2}:\d{2})\s*,\s*(\d{1,2}:\d{2})/g;
  let match;
  while ((match = linePattern.exec(raw)) !== null) {
    const start = parseMMSS(match[1]);
    const end = parseMMSS(match[2]);
    if (!isNaN(start) && !isNaN(end) && end > start) {
      results.push({ start, end });
    }
  }

  return results;
}

// ─── Pass 2 impl ─────────────────────────────────────────────────────────────

async function enrichSegments(
  segments: Array<{ start: number; end: number; text: string }>
): Promise<Array<{ score: number; score_reason: string; reason: string; hashtags: string[]; clip_title: string }>> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const models = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ].filter(Boolean) as string[];

  for (const modelName of [...new Set(models)]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(ENRICH_PROMPT(segments));
      const raw = result.response.text() ?? "";
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      console.log(`Highlights pass 2 done with model: ${modelName}`);
      return JSON.parse(cleaned);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = msg.includes("deprecated") || msg.includes("not found") || msg.includes("404") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      console.warn(`Highlights pass 2 model "${modelName}" failed: ${msg}`);
      if (!isRetryable) throw err;
    }
  }

  throw new Error("All Gemini models failed for highlights enrichment");
}

// ─── Auto mode: topic-first pipeline ─────────────────────────────────────────

const DISCOVER_TOPICS_PROMPT = (transcript: string) => `You are analyzing a video transcript to find distinct topics.

Transcript:
${transcript}

List every distinct topic, theme, or subject the speaker covers. Be specific — "AI replacing jobs" is better than "AI".
Return ONLY a JSON array of short topic strings (3-6 words each). No markdown, no explanation.
Example: ["AI replacing creative jobs", "how to future-proof your career", "tools creators should learn now"]`;

const CLIP_FOR_TOPIC_PROMPT = (transcript: string, topic: string) => `You are a video editor finding the best clip for a social media reel.

Topic to find: "${topic}"

Transcript:
${transcript}

Find the single best 30–90 second clip that covers this topic most clearly and engagingly.
Return ONLY one line: MM:SS, MM:SS
If the topic isn't covered, return: NONE`;

async function discoverTopics(transcript: string): Promise<string[]> {
  const genAI = (await import("@google/generative-ai").then(m => new m.GoogleGenerativeAI(process.env.GEMINI_API_KEY!)));
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(DISCOVER_TOPICS_PROMPT(transcript));
  const raw = result.response.text().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const topics = JSON.parse(raw) as string[];
    return topics.filter(t => typeof t === "string" && t.trim()).slice(0, 12); // cap at 12
  } catch {
    // fallback: parse line-by-line if not valid JSON
    return raw.split("\n").map(l => l.replace(/^[-*"\d.\s]+/, "").trim()).filter(Boolean).slice(0, 12);
  }
}

async function findClipForTopic(transcript: string, topic: string): Promise<{ start: number; end: number; topic: string } | null> {
  try {
    const genAI = (await import("@google/generative-ai").then(m => new m.GoogleGenerativeAI(process.env.GEMINI_API_KEY!)));
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(CLIP_FOR_TOPIC_PROMPT(transcript, topic));
    const raw = result.response.text().trim();
    if (raw === "NONE" || !raw) return null;
    const match = raw.match(/(\d{1,2}:\d{2})\s*,\s*(\d{1,2}:\d{2})/);
    if (!match) return null;
    const start = parseMMSS(match[1]);
    const end = parseMMSS(match[2]);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    return { start, end, topic };
  } catch {
    return null;
  }
}

async function generateAutoHighlights(
  formattedTranscript: string,
  rawSegments?: TranscriptSegmentInput[]
): Promise<Highlight[]> {
  console.log("Auto mode: discovering topics...");
  const topics = await discoverTopics(formattedTranscript);
  console.log(`Found ${topics.length} topics:`, topics);

  if (topics.length === 0) {
    // fallback to 5-clip manual mode
    console.warn("No topics found, falling back to manual 5-clip mode");
    return generateHighlights(formattedTranscript, rawSegments, { count: 5 });
  }

  // Find best clip for each topic in parallel
  const clipResults = await Promise.all(
    topics.map(topic => findClipForTopic(formattedTranscript, topic))
  );

  const validRanges = clipResults.filter((r): r is { start: number; end: number; topic: string } => r !== null);
  console.log(`Got ${validRanges.length} clips from ${topics.length} topics`);

  if (validRanges.length === 0) {
    console.warn("No clips found for any topic, falling back to manual 5-clip mode");
    return generateHighlights(formattedTranscript, rawSegments, { count: 5 });
  }

  // Resolve text for each clip
  const segmentsWithText = validRanges.map(({ start, end, topic }) => {
    let text = "";
    if (rawSegments) {
      text = rawSegments
        .filter(s => s.end > start && s.start < end)
        .map(s => s.text).join(" ").trim();
    }
    return { start, end, text, topic };
  });

  // Enrich
  let enriched: Array<{ score: number; score_reason: string; reason: string; hashtags: string[]; clip_title: string }>;
  try {
    enriched = await enrichSegments(segmentsWithText);
  } catch {
    enriched = segmentsWithText.map(() => ({ score: 50, score_reason: "", reason: "", hashtags: [], clip_title: "" }));
  }

  return segmentsWithText.map((seg, i) => ({
    ...seg,
    ...(enriched[i] ?? { score: 50, score_reason: "", reason: "", hashtags: [], clip_title: "" }),
  }));
}
