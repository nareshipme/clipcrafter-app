import Groq from "groq-sdk";
import fs from "fs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
}

export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (!audioPath) throw new Error("audioPath is required");

  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-large-v3",
    response_format: "verbose_json",
  });

  return {
    text: transcription.text,
    segments: ((transcription as unknown as { segments?: TranscriptSegment[] }).segments ?? []).map(
      (seg: TranscriptSegment) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })
    ),
  };
}
