import os from "os";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpeg from "fluent-ffmpeg";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { transcribeAudio } from "@/lib/transcribe";
import { generateHighlights, formatSegmentsForHighlights } from "@/lib/highlights";
import { isUsageAllowed, incrementUsage } from "@/lib/billing";

const execFileAsync = promisify(execFile);

async function updateProjectStatus(
  projectId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("projects").update(fields).eq("id", projectId);
}

type LogEntry = {
  step: string;
  provider?: string;
  detail?: string;
  status: "ok" | "error" | "fallback";
  ts: string;
};

function makeLogger(projectId: string) {
  const entries: LogEntry[] = [];
  return {
    log(entry: Omit<LogEntry, "ts">) {
      const e = { ...entry, ts: new Date().toISOString() };
      entries.push(e);
      console.log(
        `[${projectId}] ${e.step} | provider: ${e.provider ?? "-"} | ${e.status}${e.detail ? " | " + e.detail : ""}`
      );
    },
    async flush() {
      if (!entries.length) return;
      await supabaseAdmin.from("projects").update({ processing_log: entries }).eq("id", projectId);
    },
    getEntries() {
      return entries;
    },
  };
}

async function downloadR2Object(r2Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  const response = await r2Client.send(command);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function isYouTubeUrl(str: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
}

async function getYtCookiesPath(): Promise<string | null> {
  const cookiesPath = "/tmp/yt-cookies.txt";
  // Only fetch once per container lifetime
  if (fsSync.existsSync(cookiesPath)) return cookiesPath;
  try {
    const res = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: "config/yt-cookies.txt",
      })
    );
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    fsSync.writeFileSync(cookiesPath, Buffer.concat(chunks));
    return cookiesPath;
  } catch (e) {
    console.warn("yt-dlp: could not load cookies from R2:", e);
    return null;
  }
}

async function downloadYouTubeVideo(url: string, outputPath: string): Promise<void> {
  const cookiesPath = await getYtCookiesPath();
  const args = [
    "--format",
    "bestvideo[ext=mp4][protocol^=http]+bestaudio[ext=m4a][protocol^=http]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "--output",
    outputPath,
    "--no-playlist",
    "--extractor-args",
    "youtube:player_client=web",
    "--socket-timeout",
    "60",
    "--retries",
    "5",
    "--retry-sleep",
    "exp=1:30",
  ];
  if (cookiesPath) args.push("--cookies", cookiesPath);
  args.push(url);
  await execFileAsync("yt-dlp", args, { timeout: 10 * 60 * 1000 }); // 10 min max
}

function extractAudioFromVideo(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec("libmp3lame")
      .noVideo()
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

export interface ProcessVideoEventData {
  projectId: string;
  r2Key: string;
  userId: string;
}

async function runWithExistingTranscript(
  projectId: string,
  existingTranscript: { id: string; segments: unknown[] } | null,
  logger: ReturnType<typeof makeLogger>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: any
): Promise<{ highlightId: string | undefined }> {
  let highlightId: string | undefined;

  logger.log({ step: "download", provider: "skipped (reused)", status: "ok" });
  logger.log({ step: "extract-audio", provider: "skipped (reused)", status: "ok" });
  logger.log({
    step: "transcribe",
    provider: "skipped (reused)",
    detail: `${existingTranscript?.segments?.length ?? 0} segments`,
    status: "ok",
  });

  // Jump straight to highlights
  await step.run("generate-highlights", async () => {
    await updateProjectStatus(projectId, { status: "generating_highlights" });
    const existingSegs = Array.isArray(existingTranscript?.segments)
      ? (existingTranscript.segments as Array<{ start: number; end: number; text: string }>)
      : [];
    const highlights = await generateHighlights(
      formatSegmentsForHighlights(existingSegs),
      existingSegs
    );
    const hlProvider = process.env.HIGHLIGHTS_PROVIDER ?? "gemini";
    logger.log({
      step: "generate-highlights",
      provider: hlProvider,
      detail: `${highlights.length} highlights`,
      status: "ok",
    });

    const { data } = await supabaseAdmin
      .from("highlights")
      .insert({ project_id: projectId, segments: highlights })
      .select()
      .single();
    highlightId = (data as { id: string } | null)?.id;
  });

  await step.run("finalize", async () => {
    logger.log({ step: "finalize", provider: "system", status: "ok" });
    await logger.flush();
    await updateProjectStatus(projectId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
  });

  return { highlightId };
}

export async function processVideoHandler(
  event: { data: ProcessVideoEventData },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: any
): Promise<Record<string, unknown>> {
  const { projectId } = event.data;

  // Check usage limit before doing any work
  const usageCheck = await step.run("check-usage-limit", async () => {
    return isUsageAllowed(event.data.userId);
  });
  if (!usageCheck.allowed) {
    await supabaseAdmin
      .from("projects")
      .update({
        status: "failed",
        error_message: "Usage limit exceeded. Please upgrade your plan.",
      })
      .eq("id", event.data.projectId);
    return { status: "blocked", reason: "usage_limit_exceeded" };
  }

  // Use projectId for stable paths across step re-invocations (Inngest runs each step in a fresh context)
  const videoPath = path.join(os.tmpdir(), `clipcrafter-video-${projectId}.mp4`);
  const audioPath = path.join(os.tmpdir(), `clipcrafter-audio-${projectId}.mp3`);

  const logger = makeLogger(projectId);
  let transcriptId: string | undefined;
  let highlightId: string | undefined;

  try {
    // Always re-read r2_key from DB — never trust the event payload (may be stale/truncated on retries)
    const { data: projectData } = await supabaseAdmin
      .from("projects")
      .select("status, audio_key, r2_key")
      .eq("id", projectId)
      .single();

    const r2Key: string = projectData?.r2_key ?? "";
    if (!r2Key) throw new Error(`Project ${projectId} has no r2_key in DB`);

    const hasExistingTranscript = projectData?.status === "transcribed";

    if (hasExistingTranscript) {
      // Skip straight to highlights — audio + transcript already cloned
      const { data: existingTranscript } = await supabaseAdmin
        .from("transcripts")
        .select("id, segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      transcriptId = existingTranscript?.id;
      const result = await runWithExistingTranscript(
        projectId,
        existingTranscript as { id: string; segments: unknown[] } | null,
        logger,
        step
      );
      highlightId = result.highlightId;

      return {
        projectId,
        status: "completed",
        transcriptId,
        highlightId,
        processingLog: logger.getEntries(),
      };
    }

    // Step 1 — download video (R2 or YouTube)
    await step.run("download-from-r2", async () => {
      await updateProjectStatus(projectId, { status: "processing" });
      if (isYouTubeUrl(r2Key)) {
        logger.log({ step: "download", provider: "yt-dlp", detail: r2Key, status: "ok" });
        await downloadYouTubeVideo(r2Key, videoPath);

        // Upload the downloaded video to R2 so it can be played back in the browser
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        const videoBuffer = await fs.readFile(videoPath);
        const videoR2Key = `videos/${projectId}/video.mp4`;
        await r2Client.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: videoR2Key,
            Body: videoBuffer,
            ContentType: "video/mp4",
          })
        );
        // Update r2_key to the actual R2 key so artifacts API returns a presigned URL
        await updateProjectStatus(projectId, { r2_key: videoR2Key });
        logger.log({
          step: "download",
          provider: "yt-dlp → R2",
          detail: `${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB uploaded`,
          status: "ok",
        });
      } else {
        logger.log({ step: "download", provider: "Cloudflare R2", detail: r2Key, status: "ok" });
        const buffer = await downloadR2Object(r2Key);
        await fs.writeFile(videoPath, buffer);
      }
    });

    // Step 2 — extract-audio
    await step.run("extract-audio", async () => {
      await updateProjectStatus(projectId, { status: "extracting_audio" });
      logger.log({ step: "extract-audio", provider: "ffmpeg (local)", status: "ok" });
      await extractAudioFromVideo(videoPath, audioPath);

      // Upload audio to R2 so it can be linked in the UI
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const audioBuffer = await fs.readFile(audioPath);
      const audioKey = `audio/${projectId}/audio.mp3`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: audioKey,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
        })
      );
      await updateProjectStatus(projectId, { audio_key: audioKey });
      logger.log({
        step: "extract-audio",
        provider: "ffmpeg → R2",
        detail: `${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB uploaded`,
        status: "ok",
      });
    });

    // Step 3 — transcribe
    const transcript = await step.run("transcribe", async () => {
      await updateProjectStatus(projectId, { status: "transcribing" });
      logger.log({ step: "transcribe", provider: "Sarvam Saaras v3", status: "ok" });
      const result = await transcribeAudio(audioPath);
      logger.log({
        step: "transcribe",
        provider: result.provider ?? "Sarvam Saaras v3",
        detail: `${result.segments.length} segments`,
        status: "ok",
      });

      const { data } = await supabaseAdmin
        .from("transcripts")
        .insert({ project_id: projectId, segments: result.segments })
        .select()
        .single();

      transcriptId = (data as { id: string } | null)?.id;
      return result;
    });

    // Step 4 — generate-highlights
    await step.run("generate-highlights", async () => {
      await updateProjectStatus(projectId, { status: "generating_highlights" });
      const transcriptResult = transcript as {
        text: string;
        segments: Array<{ start: number; end: number; text: string }>;
      };
      const segs = transcriptResult.segments ?? [];
      const highlights = await generateHighlights(formatSegmentsForHighlights(segs), segs);
      const hlProvider = process.env.HIGHLIGHTS_PROVIDER ?? "gemini";
      logger.log({
        step: "generate-highlights",
        provider: hlProvider,
        detail: `${highlights.length} highlights`,
        status: "ok",
      });

      const { data } = await supabaseAdmin
        .from("highlights")
        .insert({ project_id: projectId, segments: highlights })
        .select()
        .single();

      highlightId = (data as { id: string } | null)?.id;
    });

    // Step 5 — finalize
    await step.run("finalize", async () => {
      await fs.unlink(videoPath).catch(() => undefined);
      await fs.unlink(audioPath).catch(() => undefined);
      logger.log({ step: "finalize", provider: "system", status: "ok" });
      await logger.flush(); // write all step logs to DB
      await updateProjectStatus(projectId, {
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    });

    // Step 6 — track usage
    await step.run("track-usage", async () => {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("duration_seconds")
        .eq("id", projectId)
        .single();
      const durationMinutes =
        ((project as { duration_seconds?: number } | null)?.duration_seconds ?? 0) / 60;
      await incrementUsage(event.data.userId, durationMinutes);
    });

    return {
      projectId,
      status: "completed",
      transcriptId,
      highlightId,
      processingLog: logger.getEntries(),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("projects")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", projectId);
    return { projectId, status: "failed", error: errorMessage };
  }
}

export const processVideo = inngest.createFunction(
  { id: "process-video", retries: 3 },
  { event: "video/process" },
  async ({ event, step }) => processVideoHandler(event as { data: ProcessVideoEventData }, step)
);
