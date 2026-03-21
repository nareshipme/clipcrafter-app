import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(HIGHLIGHTS_PROMPT(transcript));
  const raw = result.response.text();

  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned) as Highlight[];
}
