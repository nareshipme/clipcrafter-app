/**
 * Transcription provider abstraction.
 *
 * TRANSCRIPTION_PROVIDER env var:
 *   "sarvam"  → Sarvam AI Saarika (Indian languages, ₹30/hr, ~$0.36/hr) with Modal fallback
 *   "modal"   → faster-whisper on Modal GPU (unlimited, ~$0.004/hr)
 *   "groq"    → Groq Whisper API (default dev option)
 *
 * Sarvam is the recommended primary for Indian language content.
 * Modal is the fallback when Sarvam fails or for non-Indian content.
 */

import { transcribeAudio as groqTranscribeAudio, TranscriptResult } from "@/lib/groq";
import fs from "fs";

const PROVIDER = process.env.TRANSCRIPTION_PROVIDER ?? "groq";
const MODAL_URL = process.env.MODAL_TRANSCRIBE_URL ?? "";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY ?? "";

// Sarvam supports these Indian languages (BCP-47 codes)
const SARVAM_LANGUAGES = new Set([
  "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN",
  "mr-IN", "gu-IN", "bn-IN", "or-IN", "pa-IN", "ur-IN",
  "en-IN", "unknown", // unknown = auto-detect
]);

// Sarvam audio limits: max 60s per REST request → must chunk
const SARVAM_CHUNK_DURATION_SEC = 55; // 55s per chunk (5s headroom)
const SARVAM_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max per request

export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (PROVIDER === "sarvam") {
    try {
      return await transcribeWithSarvam(audioPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Sarvam transcription failed, falling back to Modal: ${msg}`);
      return await transcribeWithModal(audioPath);
    }
  }
  if (PROVIDER === "modal") {
    return transcribeWithModal(audioPath);
  }
  return groqTranscribeAudio(audioPath);
}

// ─── Sarvam (Primary for Indian languages) ───────────────────────────────────

async function transcribeWithSarvam(audioPath: string): Promise<TranscriptResult> {
  if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is not set");

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const { default: path } = await import("path");
  const { default: os } = await import("os");
  const execFileAsync = promisify(execFile);

  // Get audio duration
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  const durationSec = parseFloat(stdout.trim());

  const stats = fs.statSync(audioPath);
  const needsChunking = durationSec > SARVAM_CHUNK_DURATION_SEC || stats.size > SARVAM_MAX_FILE_SIZE;

  if (!needsChunking) {
    console.log(`Transcribing ${durationSec.toFixed(1)}s audio with Sarvam directly`);
    return transcribeSarvamChunk(audioPath, 0);
  }

  // Split into chunks
  const numChunks = Math.ceil(durationSec / SARVAM_CHUNK_DURATION_SEC);
  console.log(`Sarvam: splitting ${durationSec.toFixed(1)}s into ${numChunks} chunks of ${SARVAM_CHUNK_DURATION_SEC}s`);

  const base = path.basename(audioPath, ".mp3");
  const dir = path.dirname(audioPath);
  const pattern = path.join(dir, `${base}-sarvam-%03d.mp3`);

  await execFileAsync("ffmpeg", [
    "-i", audioPath,
    "-f", "segment",
    "-segment_time", String(SARVAM_CHUNK_DURATION_SEC),
    "-ar", "16000",
    "-ac", "1",
    "-b:a", "32k",
    "-reset_timestamps", "1",
    "-y",
    pattern,
  ]);

  const chunkFiles: string[] = [];
  let i = 0;
  while (true) {
    const p = path.join(dir, `${base}-sarvam-${String(i).padStart(3, "0")}.mp3`);
    if (!fs.existsSync(p)) break;
    chunkFiles.push(p);
    i++;
  }

  const results: TranscriptResult[] = [];
  for (let idx = 0; idx < chunkFiles.length; idx++) {
    const offsetSec = idx * SARVAM_CHUNK_DURATION_SEC;
    console.log(`Sarvam: chunk ${idx + 1}/${chunkFiles.length} (offset ${offsetSec}s)`);
    const result = await transcribeSarvamChunk(chunkFiles[idx], offsetSec);
    results.push(result);
    fs.unlink(chunkFiles[idx], () => undefined);
  }

  const allSegments = results.flatMap(r => r.segments).map((s, idx) => ({ ...s, id: idx }));
  return {
    text: results.map(r => r.text).join(" "),
    segments: allSegments,
  };
}

async function transcribeSarvamChunk(audioPath: string, offsetSec: number): Promise<TranscriptResult> {
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", fs.createReadStream(audioPath), {
    filename: "audio.mp3",
    contentType: "audio/mpeg",
  });
  form.append("model", "saarika:v2.5");
  form.append("language_code", "unknown"); // auto-detect
  form.append("with_timestamps", "true");

  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      "api-subscription-key": SARVAM_API_KEY,
      ...form.getHeaders(),
    },
    body: form as unknown as BodyInit,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam STT failed (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    transcript: string;
    timestamps?: Array<{ word: string; start: number; end: number }>;
  };

  // Sarvam returns word-level timestamps — group into segments by pause
  const segments = buildSegmentsFromWords(data.timestamps ?? [], offsetSec);

  console.log(`Sarvam transcribed chunk: "${data.transcript.slice(0, 60)}..."`);

  return {
    text: data.transcript,
    segments,
  };
}

function buildSegmentsFromWords(
  words: Array<{ word: string; start: number; end: number }>,
  offsetSec: number
): Array<{ id: number; start: number; end: number; text: string }> {
  if (!words.length) return [];

  const PAUSE_THRESHOLD = 1.5; // group words separated by < 1.5s into same segment
  const segments: Array<{ id: number; start: number; end: number; text: string }> = [];
  let current: typeof words = [];

  for (const word of words) {
    if (current.length > 0) {
      const gap = word.start - current[current.length - 1].end;
      if (gap > PAUSE_THRESHOLD) {
        segments.push({
          id: segments.length,
          start: current[0].start + offsetSec,
          end: current[current.length - 1].end + offsetSec,
          text: current.map(w => w.word).join(" "),
        });
        current = [];
      }
    }
    current.push(word);
  }

  if (current.length > 0) {
    segments.push({
      id: segments.length,
      start: current[0].start + offsetSec,
      end: current[current.length - 1].end + offsetSec,
      text: current.map(w => w.word).join(" "),
    });
  }

  return segments;
}

// ─── Modal (Fallback / Primary for non-Indian content) ────────────────────────

async function transcribeWithModal(audioPath: string): Promise<TranscriptResult> {
  if (!MODAL_URL) {
    throw new Error("MODAL_TRANSCRIBE_URL is not set. Deploy the Modal app first.");
  }

  const stats = fs.statSync(audioPath);
  const MAX_BASE64_BYTES = 10 * 1024 * 1024;

  let audioUrl: string;
  if (stats.size <= MAX_BASE64_BYTES) {
    const data = fs.readFileSync(audioPath);
    audioUrl = `data:audio/mpeg;base64,${data.toString("base64")}`;
  } else {
    audioUrl = await uploadToR2ForModal(audioPath);
  }

  const res = await fetch(MODAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      model_size: process.env.WHISPER_MODEL_SIZE ?? "large-v3",
    }),
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Modal transcription failed (${res.status}): ${err}`);
  }

  const result = await res.json() as {
    text: string;
    segments: Array<{ id: number; start: number; end: number; text: string }>;
    language: string;
    duration: number;
    elapsed_sec: number;
    realtime_factor: number;
    model: string;
  };

  console.log(`Modal: ${result.duration}s audio → ${result.elapsed_sec}s (${result.realtime_factor}x, model: ${result.model})`);

  return {
    text: result.text,
    segments: result.segments.map((s, i) => ({ id: i, start: s.start, end: s.end, text: s.text })),
  };
}

async function uploadToR2ForModal(audioPath: string): Promise<string> {
  const { r2Client, R2_BUCKET } = await import("@/lib/r2");
  const { PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const path = await import("path");

  const key = `modal-tmp/${Date.now()}-${path.basename(audioPath)}`;
  const fileBuffer = fs.readFileSync(audioPath);

  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: fileBuffer, ContentType: "audio/mpeg",
  }));

  const url = await getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 3600 });
  console.log(`Uploaded ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB to R2 for Modal`);
  return url;
}
