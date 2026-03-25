/**
 * Transcription — Sarvam Saaras v3 Batch API with speaker diarization.
 *
 * This is the only transcription provider. Modal and Groq have been removed.
 * Sarvam handles Indian languages natively with diarization, no rate limits.
 *
 * Pricing: ₹30/hour of audio (~$0.36/hr)
 * Docs: https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/batch-api
 */

import fs from "fs";

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  provider?: string;
}

const SARVAM_API_KEY = process.env.SARVAM_API_KEY ?? "";
const SARVAM_BASE = "https://api.sarvam.ai";

export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is not set");
  const result = await transcribeWithSarvam(audioPath);
  return { ...result, provider: "Sarvam Saaras v3 (diarization)" };
}

async function transcribeWithSarvam(audioPath: string): Promise<TranscriptResult> {
  const jsonHeaders = {
    "api-subscription-key": SARVAM_API_KEY,
    "Content-Type": "application/json",
  };

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
  if (!initRes.ok)
    throw new Error(`Sarvam job init failed (${initRes.status}): ${await initRes.text()}`);
  const { job_id } = (await initRes.json()) as { job_id: string };
  console.log(`Sarvam: job created → ${job_id}`);

  // Step 2 — Get presigned upload URL
  const uploadLinksRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/upload-files`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ job_id, files: ["audio.mp3"] }),
  });
  if (!uploadLinksRes.ok)
    throw new Error(
      `Sarvam upload-files failed (${uploadLinksRes.status}): ${await uploadLinksRes.text()}`
    );

  const uploadData = (await uploadLinksRes.json()) as {
    upload_urls: Record<string, { file_url: string }>;
  };
  const uploadUrl = uploadData.upload_urls?.["audio.mp3"]?.file_url;
  if (!uploadUrl) throw new Error("Sarvam: no upload URL returned");

  // Step 3 — Upload file via presigned PUT (Azure requires x-ms-blob-type header)
  const fileBuffer = fs.readFileSync(audioPath);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBuffer,
    headers: {
      "Content-Type": "audio/mpeg",
      "x-ms-blob-type": "BlockBlob", // required for Azure Blob Storage
    },
  });
  if (!putRes.ok)
    throw new Error(`Sarvam file upload failed (${putRes.status}): ${await putRes.text()}`);
  console.log(`Sarvam: uploaded ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Step 4 — Start the job
  const startRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/${job_id}/start`, {
    method: "POST",
    headers: { "api-subscription-key": SARVAM_API_KEY },
  });
  if (!startRes.ok)
    throw new Error(`Sarvam job start failed (${startRes.status}): ${await startRes.text()}`);
  console.log("Sarvam: job started, polling...");

  // Step 5 — Poll for completion (correct endpoint: /status)
  const startTime = Date.now();
  let outputFileName = "0.json"; // default, overridden from job_details

  while (Date.now() - startTime < 10 * 60 * 1000) {
    await sleep(5000);
    const statusRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/${job_id}/status`, {
      headers: { "api-subscription-key": SARVAM_API_KEY },
    });
    if (!statusRes.ok) continue;

    const status = (await statusRes.json()) as {
      job_state: string;
      error_message?: string;
      job_details?: Array<{
        outputs?: Array<{ file_name: string; file_id: string }>;
        state?: string;
        error_message?: string;
      }>;
    };

    console.log(`Sarvam: job state → ${status.job_state}`);

    if (status.job_state === "Completed") {
      // Extract output filename from job_details
      const outputFile = status.job_details?.[0]?.outputs?.[0]?.file_name;
      if (outputFile) outputFileName = outputFile;
      break;
    }
    if (status.job_state === "Failed") {
      const detail = status.job_details?.[0]?.error_message;
      throw new Error(`Sarvam job failed: ${detail ?? status.error_message ?? "unknown"}`);
    }
  }

  // Step 6 — Get presigned download URL
  const downloadLinksRes = await fetch(`${SARVAM_BASE}/speech-to-text/job/v1/download-files`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ job_id, files: [outputFileName] }),
  });
  if (!downloadLinksRes.ok)
    throw new Error(
      `Sarvam download-files failed (${downloadLinksRes.status}): ${await downloadLinksRes.text()}`
    );

  const downloadData = (await downloadLinksRes.json()) as {
    download_urls: Record<string, { file_url: string }>;
  };
  const downloadUrl = downloadData.download_urls?.[outputFileName]?.file_url;
  if (!downloadUrl) throw new Error(`Sarvam: no download URL for ${outputFileName}`);

  // Step 7 — Fetch transcript JSON
  const transcriptRes = await fetch(downloadUrl);
  if (!transcriptRes.ok)
    throw new Error(`Sarvam transcript fetch failed (${transcriptRes.status})`);
  const output = await transcriptRes.json();

  console.log(`Sarvam: transcript received, parsing...`);
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
  timestamps?: {
    words: string[];
    start_time_seconds: number[];
    end_time_seconds: number[];
  };
}): TranscriptResult {
  const diarized = output.diarized_transcript?.entries ?? [];

  if (diarized.length > 0) {
    const segments = diarized.map((entry, i) => ({
      id: i,
      start: entry.start_time_seconds,
      end: entry.end_time_seconds,
      text: `[Speaker ${entry.speaker_id}] ${entry.transcript}`,
    }));
    return {
      text: diarized.map((e) => `[Speaker ${e.speaker_id}] ${e.transcript}`).join(" "),
      segments,
    };
  }

  // Fallback: no diarization — use word timestamps grouped into segments
  const words = output.timestamps?.words ?? [];
  const starts = output.timestamps?.start_time_seconds ?? [];
  const ends = output.timestamps?.end_time_seconds ?? [];

  if (words.length > 0) {
    const wordObjs = words.map((w, i) => ({ word: w, start: starts[i] ?? 0, end: ends[i] ?? 0 }));
    const segments = groupWordsIntoSegments(wordObjs);
    return { text: output.transcript ?? words.join(" "), segments };
  }

  return {
    text: output.transcript ?? "",
    segments: output.transcript ? [{ id: 0, start: 0, end: 0, text: output.transcript }] : [],
  };
}

function groupWordsIntoSegments(
  words: Array<{ word: string; start: number; end: number }>
): Array<{ id: number; start: number; end: number; text: string }> {
  const PAUSE = 1.5;
  const segments: Array<{ id: number; start: number; end: number; text: string }> = [];
  let current: typeof words = [];

  for (const word of words) {
    if (current.length > 0 && word.start - current[current.length - 1].end > PAUSE) {
      segments.push({
        id: segments.length,
        start: current[0].start,
        end: current[current.length - 1].end,
        text: current.map((w) => w.word).join(" "),
      });
      current = [];
    }
    current.push(word);
  }
  if (current.length > 0) {
    segments.push({
      id: segments.length,
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((w) => w.word).join(" "),
    });
  }
  return segments;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
