/**
 * Transcription provider abstraction.
 *
 * TRANSCRIPTION_PROVIDER env var:
 *   "sarvam"  → Sarvam AI Saaras v3 Batch API with diarization (primary)
 *   "modal"   → faster-whisper on Modal GPU (fallback)
 *   "groq"    → Groq Whisper API
 */

import { transcribeAudio as groqTranscribeAudio, TranscriptResult } from "@/lib/groq";
import fs from "fs";

const PROVIDER = process.env.TRANSCRIPTION_PROVIDER ?? "groq";
const MODAL_URL = process.env.MODAL_TRANSCRIBE_URL ?? "";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY ?? "";
const SARVAM_BASE = "https://api.sarvam.ai";

export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (PROVIDER === "sarvam") {
    try {
      const result = await transcribeWithSarvam(audioPath);
      return { ...result, provider: "Sarvam Saaras v3 (diarization)" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Sarvam failed → falling back to Modal: ${msg}`);
      const result = await transcribeWithModal(audioPath);
      return { ...result, provider: `Modal faster-whisper (Sarvam fallback: ${msg.slice(0, 80)})` };
    }
  }
  if (PROVIDER === "modal") {
    const result = await transcribeWithModal(audioPath);
    return { ...result, provider: "Modal faster-whisper" };
  }
  const result = await groqTranscribeAudio(audioPath);
  return { ...result, provider: "Groq Whisper large-v3" };
}

// ─── Sarvam Saaras v3 Batch API with Diarization ─────────────────────────────

const SARVAM_FILENAME = "audio.mp3";

async function transcribeWithSarvam(audioPath: string): Promise<TranscriptResult> {
  if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is not set");

  const jsonHeaders = { "api-subscription-key": SARVAM_API_KEY, "Content-Type": "application/json" };

  // Step 1 — Create batch job
  console.log("Sarvam: creating batch job (Saaras v3 + diarization)...");
  const initRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      job_parameters: {
        model: "saaras:v3",
        mode: "transcribe",
        language_code: "unknown",
        with_diarization: true,
        with_timestamps: true,
      },
    }),
  });
  if (!initRes.ok) throw new Error(`Sarvam job init failed (${initRes.status}): ${await initRes.text()}`);
  const { job_id } = await initRes.json() as { job_id: string };
  console.log(`Sarvam: job created → ${job_id}`);

  // Step 2 — Get presigned upload URL
  const uploadLinksRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/upload-files`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ job_id, files: [SARVAM_FILENAME] }),
  });
  if (!uploadLinksRes.ok) throw new Error(`Sarvam get upload URLs failed (${uploadLinksRes.status}): ${await uploadLinksRes.text()}`);

  const uploadData = await uploadLinksRes.json() as {
    upload_urls: Record<string, { file_url: string }>;
  };
  const uploadUrl = uploadData.upload_urls?.[SARVAM_FILENAME]?.file_url;
  if (!uploadUrl) throw new Error(`Sarvam: no upload URL returned for ${SARVAM_FILENAME}`);

  // Step 3 — Upload file via presigned PUT
  const fileBuffer = fs.readFileSync(audioPath);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBuffer,
    headers: { "Content-Type": "audio/mpeg" },
  });
  if (!putRes.ok) throw new Error(`Sarvam file upload failed (${putRes.status})`);
  console.log(`Sarvam: uploaded ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Step 4 — Start the job
  const startRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/${job_id}/start`, {
    method: "POST",
    headers: { "api-subscription-key": SARVAM_API_KEY },
  });
  if (!startRes.ok) throw new Error(`Sarvam job start failed (${startRes.status}): ${await startRes.text()}`);
  console.log("Sarvam: job started, polling...");

  // Step 5 — Poll for completion (max 10 min)
  const startTime = Date.now();
  while (Date.now() - startTime < 10 * 60 * 1000) {
    await sleep(5000);
    const statusRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/${job_id}`, {
      headers: { "api-subscription-key": SARVAM_API_KEY },
    });
    if (!statusRes.ok) continue;
    const { job_state, error_message } = await statusRes.json() as { job_state: string; error_message?: string };
    console.log(`Sarvam: job state → ${job_state}`);
    if (job_state === "Completed") break;
    if (job_state === "Failed") throw new Error(`Sarvam job failed: ${error_message ?? "unknown"}`);
  }

  // Step 6 — Get presigned download URLs
  // Output file is named same as input but with .json extension
  const outputFileName = SARVAM_FILENAME.replace(/\.[^.]+$/, ".json");
  const downloadLinksRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/download-files`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ job_id, files: [outputFileName] }),
  });
  if (!downloadLinksRes.ok) throw new Error(`Sarvam get download URLs failed (${downloadLinksRes.status}): ${await downloadLinksRes.text()}`);

  const downloadData = await downloadLinksRes.json() as {
    download_urls: Record<string, { file_url: string }>;
  };
  const downloadUrl = downloadData.download_urls?.[outputFileName]?.file_url;
  if (!downloadUrl) throw new Error(`Sarvam: no download URL returned for ${outputFileName}`);

  // Step 7 — Fetch the transcript JSON
  const transcriptRes = await fetch(downloadUrl);
  if (!transcriptRes.ok) throw new Error(`Sarvam transcript download failed (${transcriptRes.status})`);
  const output = await transcriptRes.json();

  return parseSarvamOutput(output);
}

function parseSarvamOutput(output: {
  transcript?: string;
  diarized_transcript?: {
    entries: Array<{
      transcript: string;
      start_time_seconds: number;
      end_time_seconds: number;
      speaker_id: string;
    }>;
  };
}): TranscriptResult {
  const diarized = output.diarized_transcript?.entries ?? [];

  if (diarized.length > 0) {
    const segments = diarized.map((entry, i) => ({
      id: i,
      start: entry.start_time_seconds,
      end: entry.end_time_seconds,
      text: `[Speaker ${entry.speaker_id}] ${entry.transcript}`,
      speaker: entry.speaker_id,
    }));

    return {
      text: diarized.map(e => `[Speaker ${e.speaker_id}] ${e.transcript}`).join(" "),
      segments,
    };
  }

  // Fallback: no diarization in output
  return {
    text: output.transcript ?? "",
    segments: output.transcript ? [{ id: 0, start: 0, end: 0, text: output.transcript }] : [],
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Modal (Fallback) ─────────────────────────────────────────────────────────

async function transcribeWithModal(audioPath: string): Promise<TranscriptResult> {
  if (!MODAL_URL) throw new Error("MODAL_TRANSCRIBE_URL is not set.");

  const stats = fs.statSync(audioPath);
  const MAX_BASE64 = 10 * 1024 * 1024;

  let audioUrl: string;
  if (stats.size <= MAX_BASE64) {
    const data = fs.readFileSync(audioPath);
    audioUrl = `data:audio/mpeg;base64,${data.toString("base64")}`;
  } else {
    audioUrl = await uploadToR2ForModal(audioPath);
  }

  const res = await fetch(MODAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl, model_size: process.env.WHISPER_MODEL_SIZE ?? "large-v3" }),
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) throw new Error(`Modal failed (${res.status}): ${await res.text()}`);

  const result = await res.json() as {
    text: string;
    segments: Array<{ id: number; start: number; end: number; text: string }>;
    duration: number;
    elapsed_sec: number;
    realtime_factor: number;
    model: string;
  };

  console.log(`Modal: ${result.duration}s audio → ${result.elapsed_sec}s (${result.realtime_factor}x, ${result.model})`);

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
  const buf = fs.readFileSync(audioPath);
  await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buf, ContentType: "audio/mpeg" }));
  const url = await getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 3600 });
  console.log(`Uploaded ${(buf.length / 1024 / 1024).toFixed(1)}MB to R2 for Modal`);
  return url;
}
