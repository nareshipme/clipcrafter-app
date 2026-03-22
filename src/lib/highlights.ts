/**
 * Highlights generation — two-pass approach (same as original toolnexus):
 *
 * Pass 1 (Gemini): timestamped transcript → list of "MM:SS, MM:SS" time ranges
 *   - Simple output format, Gemini just picks timestamps that already exist in the transcript
 *   - No JSON pressure, no hallucinated floats
 *
 * Pass 2 (Gemini): for each confirmed segment, generate score/reason/hashtags/clip_title
 *   - Enrichment only, timestamps are already locked from Pass 1
 *
 * HIGHLIGHTS_PROVIDER env var:
 *   "gemini"  → Gemini 2.0-flash for Pass 1, 2.5-flash for Pass 2 (default)
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

const FIND_SEGMENTS_PROMPT = (transcript: string) => `You are an expert video editor and storyteller.

You are given a timestamped transcript. Each line is formatted as [MM:SS] text.

Transcript:
${transcript}

Instruction: Identify the 5 most impactful, emotionally resonant, and engaging highlight moments.

Output Format: Return ONLY a list of time segments in 'MM:SS, MM:SS' format (start, end per line).
Example:
00:10, 00:25
01:05, 01:20

Rules:
- Use timestamps that appear in the transcript directly — do not invent timestamps.
- Each segment should be a coherent, self-contained moment (minimum 5 seconds).
- Do not include any explanation, just the list of time pairs.`;

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
  rawSegments?: TranscriptSegmentInput[]
): Promise<Highlight[]> {
  if (!formattedTranscript) throw new Error("transcript is required");

  // Pass 1: get accurate time ranges
  const timeRanges = await findTimeRanges(formattedTranscript);

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

async function findTimeRanges(transcript: string): Promise<Array<{ start: number; end: number }>> {
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
      const result = await model.generateContent(FIND_SEGMENTS_PROMPT(transcript));
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
