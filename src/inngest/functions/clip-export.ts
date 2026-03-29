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
import { logAiUsage } from "@/lib/aiUsageLogger";
const execFileAsync = promisify(execFile);

interface CustomCaption {
  start: number; // clip-relative seconds
  end: number;
  text: string;
}

export interface ClipExportEventData {
  clipId: string;
  projectId: string;
  userId: string;
  withCaptions?: boolean;
  /** Edited captions from the browser editor (clip-relative seconds). When provided, overrides transcript-derived captions. */
  customCaptions?: CustomCaption[];
  /** Editor style overrides — if omitted, falls back to DB clip columns */
  captionStyle?: string;
  captionPosition?: string;
  captionSize?: string;
  cropMode?: string;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isYouTubeUrl(str: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
}

/** Get a short-lived presigned GET URL for any R2 key */
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

interface Segment {
  start: number;
  end: number;
  text: string;
}

function stripSpeakerTag(text: string): string {
  return text.replace(/^\[Speaker \d+\]\s*/, "");
}

/** Convert transcript segments → Remotion Caption format (0-based ms, relative to clip start) */
function toCaptions(segments: Segment[], clipStart: number, clipEnd: number) {
  return segments
    .filter((s) => s.end > clipStart && s.start < clipEnd)
    .map((s) => ({
      text: stripSpeakerTag(s.text),
      startMs: (s.start - clipStart) * 1000, // 0-based: clip start = 0ms
      endMs: (s.end - clipStart) * 1000,
      timestampMs: (s.start - clipStart) * 1000,
      confidence: 1,
    }));
}

/** Convert client-edited captions (already clip-relative seconds) → Remotion Caption format (0-based ms) */
function customCaptionsToRemotionFormat(captions: CustomCaption[], _clipStart: number) {
  return captions.map((c) => ({
    text: c.text,
    startMs: c.start * 1000, // already 0-based from the editor
    endMs: c.end * 1000,
    timestampMs: c.start * 1000,
    confidence: 1,
  }));
}

async function resolveVideoUrl(
  r2Key: string,
  isYouTube: boolean,
  projectId: string,
  clipId: string
): Promise<string> {
  if (!isYouTube) return getR2PresignedUrl(r2Key, 3 * 3600);
  const ytSourcePath = path.join(os.tmpdir(), `clipcrafter-yt-${clipId}.mp4`);
  const ytTempR2Key = `temp-sources/${projectId}/${clipId}.mp4`;
  try {
    await downloadYouTubeVideo(r2Key, ytSourcePath);
    const buf = await fs.readFile(ytSourcePath);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: ytTempR2Key,
        Body: buf,
        ContentType: "video/mp4",
      })
    );
    return getR2PresignedUrl(ytTempR2Key, 3 * 3600);
  } finally {
    await fs.unlink(ytSourcePath).catch(() => undefined);
  }
}

async function runRenderStep(
  opts: Parameters<typeof renderWithRemotion>[0],
  projectId: string,
  userId: string
) {
  const renderStart = Date.now();
  try {
    await renderWithRemotion(opts);
    await logAiUsage({
      projectId,
      userId,
      stage: "export",
      provider: "remotion",
      status: "success",
      durationMs: Date.now() - renderStart,
    });
  } catch (err) {
    await logAiUsage({
      projectId,
      userId,
      stage: "export",
      provider: "remotion",
      status: "error",
      durationMs: Date.now() - renderStart,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

interface BuildCaptionsArgs {
  withCaptions: boolean;
  customCaptions?: CustomCaption[];
  segments: Segment[];
  clipStart: number;
  clipEnd: number;
}

function buildCaptions({
  withCaptions,
  customCaptions,
  segments,
  clipStart,
  clipEnd,
}: BuildCaptionsArgs) {
  if (!withCaptions) return [];
  return customCaptions
    ? customCaptionsToRemotionFormat(customCaptions, clipStart)
    : toCaptions(segments, clipStart, clipEnd);
}

/**
 * Render clip by spawning the standalone remotion-render.mjs script.
 * This keeps @remotion/renderer completely outside the Next.js module graph.
 */
async function renderWithRemotion(opts: {
  videoSrc: string;
  startSec: number;
  endSec: number;
  captions: ReturnType<typeof toCaptions>;
  captionStyle: string;
  withCaptions: boolean;
  captionPosition: string;
  captionSize: string;
  aspectRatio: string;
  cropMode?: string;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
  outputPath: string;
}): Promise<void> {
  const propsPath = opts.outputPath + ".props.json";
  await fs.writeFile(propsPath, JSON.stringify(opts));

  const scriptPath = path.resolve(process.cwd(), "scripts/remotion-render.mjs");

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath, // same node binary
      [scriptPath, propsPath, opts.outputPath],
      { timeout: 15 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 }
    );
    if (stdout) console.log("[remotion]", stdout.slice(-500));
    if (stderr) console.warn("[remotion stderr]", stderr.slice(-500));
  } finally {
    await fs.unlink(propsPath).catch(() => undefined);
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

type ClipRow = {
  id: string;
  start_sec: number;
  end_sec: number;
  caption_style: string;
  aspect_ratio: string;
  project_id: string;
  clip_title: string | null;
  title: string | null;
};

// eslint-disable-next-line complexity
export async function clipExportHandler(
  event: { data: ClipExportEventData },
  step: { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> }
): Promise<Record<string, unknown>> {
  const {
    clipId,
    projectId,
    withCaptions = false,
    customCaptions,
    captionStyle: eventCaptionStyle,
    captionPosition: eventCaptionPosition,
    captionSize: eventCaptionSize,
    cropMode: eventCropMode,
    cropX: eventCropX,
    cropY: eventCropY,
    cropZoom: eventCropZoom,
  } = event.data;
  const outputPath = path.join(os.tmpdir(), `clipcrafter-export-${clipId}.mp4`);

  try {
    // ── Step 1: fetch DB data, return everything needed for subsequent steps ──
    const stepOneResult = (await step.run("fetch-clip-and-project", async () => {
      const { data: clipData, error: clipError } = await supabaseAdmin
        .from("clips")
        .select(
          "id, start_sec, end_sec, caption_style, aspect_ratio, project_id, clip_title, title, caption_position, caption_size, crop_mode, crop_x, crop_y, crop_zoom"
        )
        .eq("id", clipId)
        .single();
      if (clipError || !clipData) throw new Error(`Clip ${clipId} not found`);

      const { data: projectData, error: projError } = await supabaseAdmin
        .from("projects")
        .select("r2_key")
        .eq("id", projectId)
        .single();
      if (projError || !projectData?.r2_key) throw new Error(`Project ${projectId} has no r2_key`);

      const { data: transcriptData } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const allSegments: Segment[] = Array.isArray(transcriptData?.segments)
        ? (transcriptData.segments as Segment[])
        : [];

      const clipSegments = allSegments.filter(
        (s) => s.end > clipData.start_sec && s.start < clipData.end_sec
      );

      return {
        clip: clipData as ClipRow,
        segments: clipSegments,
        r2Key: projectData.r2_key as string,
        isYouTube: isYouTubeUrl(projectData.r2_key),
      };
    })) as { clip: ClipRow; segments: Segment[]; r2Key: string; isYouTube: boolean };

    const { clip, segments, r2Key, isYouTube } = stepOneResult;

    // ── Step 2: resolve an HTTPS URL Remotion's Chromium can fetch ──
    const videoUrl = (await step.run("resolve-video-url", () =>
      resolveVideoUrl(r2Key, isYouTube, projectId, clipId)
    )) as string;

    // ── Step 3: render with Remotion (videoUrl is always HTTPS) ──
    const clipExt = clip as ClipRow & {
      caption_position?: string;
      caption_size?: string;
      crop_mode?: string;
      crop_x?: number;
      crop_y?: number;
      crop_zoom?: number;
    };
    const renderOpts = {
      videoSrc: videoUrl,
      startSec: clip.start_sec,
      endSec: clip.end_sec,
      withCaptions,
      outputPath,
      captions: buildCaptions({
        withCaptions,
        customCaptions,
        segments,
        clipStart: clip.start_sec,
        clipEnd: clip.end_sec,
      }),
      captionStyle: eventCaptionStyle ?? clip.caption_style ?? "hormozi",
      captionPosition: eventCaptionPosition ?? clipExt.caption_position ?? "bottom",
      captionSize: eventCaptionSize ?? clipExt.caption_size ?? "md",
      aspectRatio: clip.aspect_ratio || "9:16",
      cropMode: eventCropMode ?? clipExt.crop_mode ?? "cover",
      cropX: eventCropX ?? clipExt.crop_x ?? 50,
      cropY: eventCropY ?? clipExt.crop_y ?? 50,
      cropZoom: eventCropZoom ?? clipExt.crop_zoom ?? 1,
    };
    await step.run("trim-and-render", () =>
      runRenderStep(renderOpts, projectId, event.data.userId)
    );

    // ── Step 4: upload rendered clip to R2 ──
    const exportUrl = (await step.run("upload-to-r2", async () => {
      const exportKey = `exports/${projectId}/${clipId}.mp4`;
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: exportKey,
          Body: await fs.readFile(outputPath),
          ContentType: "video/mp4",
        })
      );

      // Build a safe filename for Content-Disposition
      const rawTitle = clip.clip_title ?? clip.title ?? `clip-${clipId}`;
      const safeFilename =
        rawTitle
          .replace(/[^a-z0-9\s-]/gi, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 80) || `clip-${clipId}`;
      const filename = `${safeFilename}.mp4`;

      const presignedUrl = await getSignedUrl(
        r2Client,
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: exportKey,
          // Forces download instead of inline play in mobile browsers
          ResponseContentDisposition: `attachment; filename="${filename}"`,
          ResponseContentType: "video/mp4",
        }),
        { expiresIn: 7 * 24 * 3600 }
      );

      await supabaseAdmin
        .from("clips")
        .update({ status: "exported", export_url: presignedUrl })
        .eq("id", clipId);

      return presignedUrl;
    })) as string;

    // ── Step 5: cleanup ──
    await step.run("cleanup", async () => {
      await fs.unlink(outputPath).catch(() => undefined);
    });

    return { clipId, projectId, status: "exported", exportUrl };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("clips").update({ status: "pending" }).eq("id", clipId);
    await fs.unlink(outputPath).catch(() => undefined);
    return { clipId, status: "failed", error: errorMessage };
  }
}

export const clipExport = inngest.createFunction(
  { id: "clip-export", retries: 2 },
  { event: "clipcrafter/clip.export" },
  async ({ event, step }) => clipExportHandler(event as { data: ClipExportEventData }, step)
);
