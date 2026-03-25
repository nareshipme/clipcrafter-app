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
  export_url: string | null;
  clip_title: string | null;
};

async function downloadFromR2(r2Key: string, outputPath: string): Promise<void> {
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

  // Use event ID for stable tmp paths across retries
  const stableId = event.id.replace(/[^a-z0-9]/gi, "-").slice(0, 40);
  const outputPath = path.join(os.tmpdir(), `stitch-${stableId}.mp4`);
  const concatPath = path.join(os.tmpdir(), `concat-${stableId}.txt`);

  // Step 1: Fetch clips from Supabase and validate all are exported
  const clips = (await step.run("fetch-clips", async () => {
    const { data, error } = await supabaseAdmin
      .from("clips")
      .select("id, start_sec, end_sec, export_url, clip_title")
      .eq("project_id", projectId)
      .in("id", clipIds);

    if (error || !data) throw new Error("Failed to fetch clips from database");

    const missing = (data as ClipRow[]).filter((c) => !c.export_url);
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} clip(s) not yet exported. Export them individually first.`
      );
    }

    return (data as ClipRow[]).sort((a, b) => a.start_sec - b.start_sec);
  })) as ClipRow[];

  // Derive deterministic local paths
  const downloadedPaths = clips.map((clip) =>
    path.join(os.tmpdir(), `stitch-clip-${stableId}-${clip.id}.mp4`)
  );

  // Step 2: Download each clip's MP4 from R2
  await step.run("download-clips", async () => {
    for (let i = 0; i < clips.length; i++) {
      const r2Key = `exports/${projectId}/${clips[i].id}.mp4`;
      await downloadFromR2(r2Key, downloadedPaths[i]);
    }
  });

  // Step 3: Stitch with ffmpeg and upload to R2
  const stitchUrl = (await step.run("stitch-and-upload", async () => {
    // Write ffmpeg concat manifest
    const concatContent = downloadedPaths.map((p) => `file '${p}'`).join("\n");
    await fs.writeFile(concatPath, concatContent);

    // ffmpeg concat demuxer — copy streams without re-encoding
    await execFileAsync(
      "ffmpeg",
      ["-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", "-y", outputPath],
      { timeout: 10 * 60 * 1000 }
    );

    const stitchedKey = `exports/${projectId}/stitched-${stableId}.mp4`;
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: stitchedKey,
        Body: await fs.readFile(outputPath),
        ContentType: "video/mp4",
      })
    );

    const url = await getSignedUrl(
      r2Client,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: stitchedKey }),
      { expiresIn: 7 * 24 * 3600 }
    );

    return url;
  })) as string;

  // Step 4: Cleanup tmp files
  await step.run("cleanup", async () => {
    const toDelete = [...downloadedPaths, concatPath, outputPath];
    await Promise.all(toDelete.map((f) => fs.unlink(f).catch(() => undefined)));
  });

  return { projectId, stitchUrl, clipCount: clips.length };
}

export const stitchClips = inngest.createFunction(
  { id: "stitch-clips", retries: 2 },
  { event: "clipcrafter/clips.stitch" },
  async ({ event, step }) =>
    stitchClipsHandler(event as { id: string; data: StitchClipsEventData }, step)
);
