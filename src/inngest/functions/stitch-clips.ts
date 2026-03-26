import os from "os";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";

const execFileAsync = promisify(execFile);

export interface StitchClipsEventData {
  projectId: string;
  clipIds: string[];
  withCaptions: boolean;
}

type ClipRow = {
  id: string;
  start_sec: number;
  end_sec: number;
  clip_title: string | null;
};

function isYouTubeUrl(str: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
}

async function getR2PresignedUrl(r2Key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }), {
    expiresIn,
  });
}

async function downloadYouTubeVideo(url: string, outputPath: string): Promise<void> {
  await execFileAsync(
    "yt-dlp",
    [
      "--format",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format",
      "mp4",
      "--output",
      outputPath,
      "--no-playlist",
      "--extractor-args",
      "youtube:player_client=web,android",
      "--socket-timeout",
      "30",
      url,
    ],
    { timeout: 5 * 60 * 1000 }
  );
}

async function downloadFromR2ToFile(r2Key: string, outputPath: string): Promise<void> {
  const response = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }));
  const body = response.Body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  await fs.writeFile(outputPath, Buffer.concat(chunks));
}

export async function stitchClipsHandler(
  event: { id: string; data: StitchClipsEventData },
  step: { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> }
): Promise<Record<string, unknown>> {
  const { projectId, clipIds } = event.data;

  // Stable tmp paths keyed by event ID (safe across Inngest step retries)
  const stableId = event.id.replace(/[^a-z0-9]/gi, "-").slice(0, 40);
  const tmpDir = os.tmpdir();
  const concatPath = path.join(tmpDir, `stitch-concat-${stableId}.txt`);
  const outputPath = path.join(tmpDir, `stitch-out-${stableId}.mp4`);
  const sourceVideoPath = path.join(tmpDir, `stitch-source-${stableId}.mp4`);

  // ── Step 1: fetch clips + project source video from DB ──
  const { clips, r2Key, isYouTube } = (await step.run("fetch-data", async () => {
    const { data: clipData, error: clipError } = await supabaseAdmin
      .from("clips")
      .select("id, start_sec, end_sec, clip_title")
      .eq("project_id", projectId)
      .in("id", clipIds);

    if (clipError || !clipData) throw new Error("Failed to fetch clips from database");

    const { data: projectData, error: projError } = await supabaseAdmin
      .from("projects")
      .select("r2_key")
      .eq("id", projectId)
      .single();

    if (projError || !projectData?.r2_key) throw new Error(`Project ${projectId} has no r2_key`);

    // Sort clips by start time so the stitched video is chronological
    const sorted = (clipData as ClipRow[]).sort((a, b) => a.start_sec - b.start_sec);

    return {
      clips: sorted,
      r2Key: projectData.r2_key as string,
      isYouTube: isYouTubeUrl(projectData.r2_key),
    };
  })) as { clips: ClipRow[]; r2Key: string; isYouTube: boolean };

  // ── Step 2: get the source video locally ──
  // R2 video  → download directly
  // YouTube   → yt-dlp download
  await step.run("download-source", async () => {
    if (isYouTube) {
      await downloadYouTubeVideo(r2Key, sourceVideoPath);
    } else {
      await downloadFromR2ToFile(r2Key, sourceVideoPath);
    }
  });

  // ── Step 3: cut each clip segment from the source & stitch together ──
  const stitchUrl = (await step.run("cut-and-stitch", async () => {
    // Cut each clip into its own tmp file
    const segmentPaths: string[] = [];
    for (const clip of clips) {
      const segPath = path.join(tmpDir, `stitch-seg-${stableId}-${clip.id}.mp4`);
      segmentPaths.push(segPath);
      await execFileAsync(
        "ffmpeg",
        [
          "-ss",
          String(clip.start_sec),
          "-to",
          String(clip.end_sec),
          "-i",
          sourceVideoPath,
          "-c",
          "copy",
          "-avoid_negative_ts",
          "make_zero",
          "-y",
          segPath,
        ],
        { timeout: 5 * 60 * 1000 }
      );
    }

    // Write concat manifest
    const concatContent = segmentPaths.map((p) => `file '${p}'`).join("\n");
    await fs.writeFile(concatPath, concatContent);

    // Concat all segments — copy streams, no re-encode
    await execFileAsync(
      "ffmpeg",
      ["-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", "-y", outputPath],
      { timeout: 10 * 60 * 1000 }
    );

    // Upload to R2
    const stitchedKey = `exports/${projectId}/stitched-${stableId}.mp4`;
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: stitchedKey,
        Body: await fs.readFile(outputPath),
        ContentType: "video/mp4",
      })
    );

    // Presign for 7 days
    const url = await getR2PresignedUrl(stitchedKey, 7 * 24 * 3600);

    // Cleanup segment files
    await Promise.all(segmentPaths.map((p) => fs.unlink(p).catch(() => undefined)));

    return url;
  })) as string;

  // ── Step 4: cleanup source + working files ──
  await step.run("cleanup", async () => {
    await Promise.all(
      [sourceVideoPath, concatPath, outputPath].map((f) => fs.unlink(f).catch(() => undefined))
    );
  });

  // ── Step 5: save stitch_url to projects table ──
  await step.run("save-stitch-url", async () => {
    await supabaseAdmin.from("projects").update({ stitch_url: stitchUrl }).eq("id", projectId);
  });

  return { projectId, stitchUrl, clipCount: clips.length };
}

export const stitchClips = inngest.createFunction(
  { id: "stitch-clips", retries: 2 },
  { event: "clipcrafter/clips.stitch" },
  async ({ event, step }) =>
    stitchClipsHandler(event as { id: string; data: StitchClipsEventData }, step)
);
