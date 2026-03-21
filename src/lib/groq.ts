import Groq from "groq-sdk";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

let _groq: Groq | undefined;
function getGroqClient(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

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

const GROQ_MAX_BYTES = 24 * 1024 * 1024; // 24MB (leave 1MB headroom under 25MB limit)

/**
 * Re-encode audio to lower bitrate mono MP3 to fit under Groq's 25MB limit.
 * Uses ffmpeg to convert to 64k mono, which is ~28MB/hour — enough for most videos.
 */
async function compressAudio(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.mp3$/, "-compressed.mp3");
  await execFileAsync("ffmpeg", [
    "-i", inputPath,
    "-ar", "16000",     // 16kHz sample rate (sufficient for speech)
    "-ac", "1",         // mono
    "-b:a", "32k",      // 32kbps — ~14MB/hour, well under limit
    "-y",               // overwrite
    outputPath,
  ]);
  return outputPath;
}

export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (!audioPath) throw new Error("audioPath is required");

  let filePath = audioPath;

  // Check file size — compress if over Groq's limit
  const stats = fs.statSync(audioPath);
  if (stats.size > GROQ_MAX_BYTES) {
    console.log(`Audio file ${stats.size} bytes > 24MB limit, compressing...`);
    filePath = await compressAudio(audioPath);
    const newStats = fs.statSync(filePath);
    console.log(`Compressed to ${newStats.size} bytes`);
  }

  const transcription = await getGroqClient().audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-large-v3",
    response_format: "verbose_json",
  });

  // Clean up compressed file if we created one
  if (filePath !== audioPath) {
    fs.unlink(filePath, () => undefined);
  }

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
