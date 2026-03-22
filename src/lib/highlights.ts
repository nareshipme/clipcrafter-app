/**
 * Highlights generation — extracts top engaging moments from a transcript.
 *
 * HIGHLIGHTS_PROVIDER env var:
 *   "sarvam"  → Sarvam-30B / Sarvam-105B via chat completions (Indian language aware, free)
 *   "gemini"  → Gemini 2.5-flash with fallback chain (default)
 *
 * Sarvam chat API is OpenAI-compatible: POST https://api.sarvam.ai/v1/chat/completions
 * Model: sarvam-m (free) or sarvam-30b / sarvam-105b
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

const PROVIDER = process.env.HIGHLIGHTS_PROVIDER ?? "gemini";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY ?? "";

const HIGHLIGHTS_PROMPT = (transcript: string) => `
You are a video content analyst. Given the following transcript, extract the top 5 most engaging and highlight-worthy moments.

Score each highlight 0-100 using this rubric:
- Hook strength (first 3 seconds of text): 30pts
- Emotional punch: 20pts
- Keyword density: 15pts
- Quotability: 20pts
- Actionability: 15pts

Return ONLY a valid JSON array with no markdown, no extra text. Format:
[{
  "start": <seconds>,
  "end": <seconds>,
  "text": "<quote>",
  "reason": "<why it's engaging>",
  "score": <0-100 integer>,
  "score_reason": "<brief scoring justification>",
  "hashtags": ["<tag1>", "<tag2>", "<tag3>"],
  "clip_title": "<punchy 5-8 word title for this clip>"
}]

Transcript:
${transcript}
`.trim();

export async function generateHighlights(transcript: string): Promise<Highlight[]> {
  if (!transcript) throw new Error("transcript is required");

  if (PROVIDER === "sarvam") {
    try {
      return await generateWithSarvam(transcript);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Sarvam highlights failed → falling back to Gemini: ${msg}`);
      return generateWithGemini(transcript);
    }
  }

  return generateWithGemini(transcript);
}

// ─── Sarvam Chat Completions (OpenAI-compatible) ─────────────────────────────

async function generateWithSarvam(transcript: string): Promise<Highlight[]> {
  if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY not set");

  // Try models in order: sarvam-m (free) → sarvam-30b → sarvam-105b
  const models = [
    process.env.SARVAM_LLM_MODEL,
    "sarvam-m",
    "sarvam-30b",
  ].filter(Boolean) as string[];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: HIGHLIGHTS_PROMPT(transcript) }],
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Sarvam chat (${model}) failed (${res.status}): ${err}`);
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const raw = data.choices?.[0]?.message?.content ?? "";
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned) as Highlight[];
      console.log(`Sarvam highlights generated with model: ${model}`);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Sarvam highlights model "${model}" failed: ${msg}`);
      lastError = err instanceof Error ? err : new Error(msg);
      // Only retry on model errors, not parse errors
      if (msg.includes("JSON") || msg.includes("parse")) throw lastError;
    }
  }

  throw lastError ?? new Error("All Sarvam models failed");
}

// ─── Gemini (Fallback) ────────────────────────────────────────────────────────

async function generateWithGemini(transcript: string): Promise<Highlight[]> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const models = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
  ].filter(Boolean) as string[];

  let lastError: Error | null = null;

  for (const modelName of [...new Set(models)]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(HIGHLIGHTS_PROMPT(transcript));
      const raw = result.response.text();
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      console.log(`Gemini highlights generated with model: ${modelName}`);
      return JSON.parse(cleaned) as Highlight[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = msg.includes("deprecated") || msg.includes("not found") || msg.includes("404") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      console.warn(`Gemini model "${modelName}" failed: ${msg}`);
      lastError = err instanceof Error ? err : new Error(msg);
      if (!isRetryable) throw lastError;
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}
