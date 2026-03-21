import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | undefined;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return _genAI;
}

// Model preference order — tries each in sequence until one succeeds.
// Override via GEMINI_MODEL env var (e.g. "gemini-2.5-pro") to skip fallback.
const MODEL_FALLBACK_CHAIN = [
  process.env.GEMINI_MODEL,          // env override (highest priority)
  "gemini-2.5-flash",                // latest stable (confirmed available)
  "gemini-2.0-flash",                // previous stable fallback
  "gemini-flash-latest",             // rolling alias — always points to latest flash
  "gemini-2.0-flash-lite",           // lighter fallback
].filter(Boolean) as string[];

// Deduplicate while preserving order
const MODELS = [...new Set(MODEL_FALLBACK_CHAIN)];

export interface Highlight {
  start: number;
  end: number;
  text: string;
  reason: string;
}

const HIGHLIGHTS_PROMPT = (transcript: string) => `
You are a video content analyst. Given the following transcript, extract the top 5 most engaging and highlight-worthy moments.

Return ONLY a valid JSON array with no markdown, no extra text. Format:
[{ "start": <seconds>, "end": <seconds>, "text": "<quote>", "reason": "<why it's engaging>" }]

Transcript:
${transcript}
`.trim();

export async function generateHighlights(transcript: string): Promise<Highlight[]> {
  if (!transcript) throw new Error("transcript is required");

  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    try {
      const model = getGenAI().getGenerativeModel({ model: modelName });
      const result = await model.generateContent(HIGHLIGHTS_PROMPT(transcript));
      const raw = result.response.text();
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned) as Highlight[];
      console.log(`Gemini highlights generated with model: ${modelName}`);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only retry on model-related errors (deprecated, not found, quota)
      const isRetryable =
        msg.includes("deprecated") ||
        msg.includes("not found") ||
        msg.includes("404") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota");

      console.warn(`Gemini model "${modelName}" failed: ${msg}`);
      lastError = err instanceof Error ? err : new Error(msg);

      if (!isRetryable) throw lastError; // auth errors, bad prompts etc — don't retry
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}
