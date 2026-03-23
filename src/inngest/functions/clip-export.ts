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

// Check once at module load whether this ffmpeg supports drawtext (requires libfreetype)
let _drawtextSupported: boolean | null = null;
async function drawtextSupported(): Promise<boolean> {
  if (_drawtextSupported !== null) return _drawtextSupported;
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-filters"], { timeout: 5000 });
    _drawtextSupported = stdout.includes("drawtext");
  } catch {
    _drawtextSupported = false;
  }
  return _drawtextSupported;
}

export interface ClipExportEventData {
  clipId: string;
  projectId: string;
  userId: string;
  withCaptions?: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isYouTubeUrl(str: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
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

async function downloadYouTubeVideo(url: string, outputPath: string): Promise<void> {
  await execFileAsync("yt-dlp", [
    "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format", "mp4",
    "--output", outputPath,
    "--no-playlist",
    "--extractor-args", "youtube:player_client=web,android",
    "--socket-timeout", "30",
    url,
  ], { timeout: 5 * 60 * 1000 });
}

function escapeDrawtext(text: string): string {
  // Escape special characters for ffmpeg drawtext filter
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function stripSpeakerTag(text: string): string {
  return text.replace(/^\[Speaker \d+\]\s*/, "");
}

function buildCaptionStyle(style: string): Record<string, string> {
  switch (style) {
    case "hormozi":
      return {
        fontcolor: "yellow",
        fontsize: "30",
        box: "1",
        boxcolor: "black@0.9",
        boxborderw: "10",
      };
    case "modern":
      return {
        fontcolor: "white",
        fontsize: "26",
        box: "1",
        boxcolor: "black@0.6",
        boxborderw: "8",
      };
    case "neon":
      return {
        fontcolor: "lime",
        fontsize: "26",
        shadowcolor: "lime",
        shadowx: "2",
        shadowy: "2",
      };
    case "minimal":
    default:
      return {
        fontcolor: "white",
        fontsize: "24",
      };
  }
}

interface Segment {
  start: number;
  end: number;
  text: string;
}

function buildDrawtextFilter(
  segments: Segment[],
  clipStart: number,
  clipEnd: number,
  captionStyle: string
): string | null {
  const relevant = segments.filter(s => s.end > clipStart && s.start < clipEnd);
  if (relevant.length === 0) return null;

  const style = buildCaptionStyle(captionStyle);

  const filters = relevant.map(seg => {
    const tStart = Math.max(0, seg.start - clipStart);
    const tEnd = Math.min(clipEnd - clipStart, seg.end - clipStart);
    const text = escapeDrawtext(stripSpeakerTag(seg.text));

    const styleStr = Object.entries(style)
      .map(([k, v]) => `${k}=${v}`)
      .join(":");

    return (
      `drawtext=text='${text}'` +
      `:enable='between(t,${tStart.toFixed(3)},${tEnd.toFixed(3)})'` +
      `:x=(w-text_w)/2:y=h-th-60` +
      `:${styleStr}`
    );
  });

  return filters.join(",");
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function clipExportHandler(
  event: { data: ClipExportEventData },
  step: { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> }
): Promise<Record<string, unknown>> {
  const { clipId, projectId, withCaptions = false } = event.data;

  const sourcePath = path.join(os.tmpdir(), `clipcrafter-export-${clipId}-source.mp4`);
  const outputPath = path.join(os.tmpdir(), `clipcrafter-export-${clipId}.mp4`);

  try {
    // Step 1 — fetch clip, project, and transcript segments
    const { clip, segments, r2Key } = await step.run("fetch-clip-and-project", async () => {
      const { data: clipData, error: clipError } = await supabaseAdmin
        .from("clips")
        .select("id, start_sec, end_sec, caption_style, aspect_ratio, project_id")
        .eq("id", clipId)
        .single();

      if (clipError || !clipData) throw new Error(`Clip ${clipId} not found`);

      const { data: projectData, error: projError } = await supabaseAdmin
        .from("projects")
        .select("r2_key, audio_key")
        .eq("id", projectId)
        .single();

      if (projError || !projectData) throw new Error(`Project ${projectId} not found`);
      if (!projectData.r2_key) throw new Error(`Project ${projectId} has no r2_key`);

      // Fetch transcript segments in the clip range
      const { data: transcriptData } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const allSegments: Segment[] = Array.isArray(transcriptData?.segments)
        ? transcriptData.segments as Segment[]
        : [];

      const clipSegments = allSegments.filter(
        s => s.end > clipData.start_sec && s.start < clipData.end_sec
      );

      return {
        clip: clipData as { id: string; start_sec: number; end_sec: number; caption_style: string; aspect_ratio: string; project_id: string },
        segments: clipSegments,
        r2Key: projectData.r2_key as string,
      };
    }) as { clip: { id: string; start_sec: number; end_sec: number; caption_style: string; aspect_ratio: string; project_id: string }; segments: Segment[]; r2Key: string };

    // Step 2 — download source video
    await step.run("download-video", async () => {
      if (isYouTubeUrl(r2Key)) {
        await downloadYouTubeVideo(r2Key, sourcePath);
      } else {
        const buffer = await downloadR2Object(r2Key);
        await fs.writeFile(sourcePath, buffer);
      }
    });

    // Step 3 — trim and render with optional captions
    await step.run("trim-and-render", async () => {
      const duration = clip.end_sec - clip.start_sec;

      const canDrawtext = await drawtextSupported();
      const drawtextFilter =
        withCaptions && canDrawtext && segments.length > 0
          ? buildDrawtextFilter(segments, clip.start_sec, clip.end_sec, clip.caption_style)
          : null;

      if (withCaptions && !canDrawtext) {
        console.warn("[clip-export] drawtext not supported by this ffmpeg build — exporting without captions");
      }

      const args: string[] = ["-y", "-i", sourcePath, "-ss", String(clip.start_sec), "-t", String(duration)];

      if (drawtextFilter) {
        // Re-encode with caption overlay
        args.push("-vf", drawtextFilter, "-c:v", "libx264", "-crf", "23", "-preset", "fast");
      } else {
        // Stream-copy video (no re-encode) — much faster
        args.push("-c:v", "copy");
      }

      args.push("-c:a", "aac", "-movflags", "+faststart", outputPath);

      await execFileAsync("ffmpeg", args, { timeout: 10 * 60 * 1000 });
    });

    // Step 4 — upload to R2 and generate presigned URL
    const exportUrl = await step.run("upload-to-r2", async () => {
      const outputBuffer = await fs.readFile(outputPath);
      const exportKey = `exports/${projectId}/${clipId}.mp4`;

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: exportKey,
        Body: outputBuffer,
        ContentType: "video/mp4",
      }));

      const presignedUrl = await getSignedUrl(
        r2Client,
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: exportKey }),
        { expiresIn: 7 * 24 * 3600 } // 1 week
      );

      await supabaseAdmin
        .from("clips")
        .update({ status: "exported", export_url: presignedUrl })
        .eq("id", clipId);

      return presignedUrl;
    }) as string;

    // Step 5 — cleanup temp files
    await step.run("cleanup", async () => {
      await Promise.allSettled([
        fs.unlink(sourcePath),
        fs.unlink(outputPath),
      ]);
    });

    return { clipId, projectId, status: "exported", exportUrl };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("clips")
      .update({ status: "pending" })
      .eq("id", clipId);

    // Best-effort cleanup
    await Promise.allSettled([
      fs.unlink(sourcePath).catch(() => undefined),
      fs.unlink(outputPath).catch(() => undefined),
    ]);

    return { clipId, status: "failed", error: errorMessage };
  }
}

export const clipExport = inngest.createFunction(
  { id: "clip-export", retries: 2 },
  { event: "clipcrafter/clip.export" },
  async ({ event, step }) => clipExportHandler(event as { data: ClipExportEventData }, step)
);
