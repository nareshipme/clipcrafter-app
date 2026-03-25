import Groq from "groq-sdk";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

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
  provider?: string; // which backend actually handled this
}

// Groq hard limit is 25MB. We target 20MB chunks to be safe.
const GROQ_MAX_BYTES = 24 * 1024 * 1024;
// Each chunk = 20 minutes of audio. At 32kbps mono that's ~4.8MB — well under limit.
const CHUNK_DURATION_SEC = 20 * 60; // 20 minutes

/**
 * Get audio duration in seconds using ffprobe.
 */
async function getAudioDurationSec(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseFloat(stdout.trim());
}

/**
 * Split audio into fixed-duration chunks using ffmpeg.
 * Returns array of chunk file paths.
 */
async function splitAudioIntoChunks(
  audioPath: string,
  chunkDurationSec: number
): Promise<string[]> {
  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath, ".mp3");
  const pattern = path.join(dir, `${base}-chunk-%03d.mp3`);

  await execFileAsync("ffmpeg", [
    "-i",
    audioPath,
    "-f",
    "segment",
    "-segment_time",
    String(chunkDurationSec),
    "-ar",
    "16000", // 16kHz — sufficient for speech
    "-ac",
    "1", // mono
    "-b:a",
    "32k", // 32kbps — ~4.8MB per 20min chunk
    "-reset_timestamps",
    "1",
    "-y",
    pattern,
  ]);

  // Collect the output chunks in order
  const chunkFiles: string[] = [];
  let i = 0;
  while (true) {
    const chunkPath = path.join(dir, `${base}-chunk-${String(i).padStart(3, "0")}.mp3`);
    if (!fs.existsSync(chunkPath)) break;
    chunkFiles.push(chunkPath);
    i++;
  }

  return chunkFiles;
}

/**
 * Transcribe a single audio file via Groq Whisper.
 * timeOffsetSec is added to all segment timestamps (for stitching chunks).
 */
async function transcribeChunk(filePath: string, timeOffsetSec: number): Promise<TranscriptResult> {
  let transcription;
  try {
    transcription = await getGroqClient().audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryMs = parseRetryAfterMs(msg);
    if (retryMs) {
      throw new Error(
        `Groq rate limit — retry after ${Math.ceil(retryMs / 1000)}s. Original: ${msg}`
      );
    }
    throw err;
  }

  const rawSegments =
    (transcription as unknown as { segments?: TranscriptSegment[] }).segments ?? [];

  return {
    text: transcription.text,
    segments: rawSegments.map((seg, idx) => ({
      id: seg.id ?? idx,
      start: (seg.start ?? 0) + timeOffsetSec,
      end: (seg.end ?? 0) + timeOffsetSec,
      text: seg.text,
    })),
  };
}

/**
 * Parse Groq's "Please try again in Xm Ys" message and return ms to wait.
 */
function parseRetryAfterMs(message: string): number | null {
  const match = message.match(/try again in (\d+)m(\d+)s/);
  if (match) return (parseInt(match[1]) * 60 + parseInt(match[2]) + 5) * 1000;
  const secMatch = message.match(/try again in (\d+)s/);
  if (secMatch) return (parseInt(secMatch[1]) + 5) * 1000;
  return null;
}

/**
 * Transcribe an audio file, automatically chunking if it's too large.
 *
 * Strategy:
 * 1. If file is under 24MB → send directly (fast path)
 * 2. Otherwise → split into 20-min chunks at 32kbps mono, transcribe each, stitch results
 */
export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (!audioPath) throw new Error("audioPath is required");

  const stats = fs.statSync(audioPath);

  // Fast path: file is small enough to send directly
  if (stats.size <= GROQ_MAX_BYTES) {
    console.log(`Transcribing ${(stats.size / 1024 / 1024).toFixed(1)}MB directly`);
    return transcribeChunk(audioPath, 0);
  }

  // Slow path: split into chunks
  const durationSec = await getAudioDurationSec(audioPath);
  const estimatedChunks = Math.ceil(durationSec / CHUNK_DURATION_SEC);
  console.log(
    `Audio ${(stats.size / 1024 / 1024).toFixed(1)}MB, ${Math.round(durationSec / 60)}min — splitting into ~${estimatedChunks} chunks of ${CHUNK_DURATION_SEC / 60}min`
  );

  const chunkFiles = await splitAudioIntoChunks(audioPath, CHUNK_DURATION_SEC);
  console.log(`Created ${chunkFiles.length} chunks`);

  const results: TranscriptResult[] = [];
  for (let i = 0; i < chunkFiles.length; i++) {
    const timeOffsetSec = i * CHUNK_DURATION_SEC;
    console.log(`Transcribing chunk ${i + 1}/${chunkFiles.length} (offset: ${timeOffsetSec}s)`);
    const result = await transcribeChunk(chunkFiles[i], timeOffsetSec);
    results.push(result);

    // Clean up chunk immediately after transcription to save disk space
    fs.unlink(chunkFiles[i], () => undefined);
  }

  // Stitch all chunks together
  const allSegments = results
    .flatMap((r) => r.segments)
    .map((seg, idx) => ({
      ...seg,
      id: idx, // re-index globally
    }));

  return {
    text: results.map((r) => r.text).join(" "),
    segments: allSegments,
  };
}
