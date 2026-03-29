#!/usr/bin/env node
/**
 * Standalone Remotion render script.
 * Invoked by the Inngest clip-export job via execFile.
 * Reads props from a JSON file, renders, writes output MP4.
 *
 * Usage: node scripts/remotion-render.mjs <props-json-path> <output-mp4-path>
 *
 * Props JSON shape:
 * {
 *   videoSrc: string,         // HTTPS presigned URL
 *   startSec: number,
 *   endSec: number,
 *   captions: Caption[],
 *   captionStyle: string,
 *   withCaptions: boolean,
 *   captionPosition?: string, // "top" | "center" | "bottom" (default: "bottom")
 *   captionSize?: string,     // "sm" | "md" | "lg" (default: "md")
 *   aspectRatio?: string,     // "9:16" | "16:9" | "1:1" (default: "9:16")
 * }
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const [,, propsPath, outputPath] = process.argv;
if (!propsPath || !outputPath) {
  console.error("Usage: remotion-render.mjs <props.json> <output.mp4>");
  process.exit(1);
}

const props = JSON.parse(readFileSync(propsPath, "utf8"));

// Sanity check — videoSrc must be an HTTPS URL (Remotion's Chromium fetches it via HTTP)
if (props.videoSrc && !props.videoSrc.startsWith("http")) {
  throw new Error(`videoSrc must be an HTTPS URL, got: ${props.videoSrc}`);
}

const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");

const entryPoint = resolve(__dirname, "../src/remotion/index.ts");

console.log("[remotion] bundling...");
const bundled = await bundle({ entryPoint, enableCaching: true });

console.log("[remotion] selecting composition...");
const composition = await selectComposition({
  serveUrl: bundled,
  id: "ClipComposition",
  inputProps: props,
});

console.log("[remotion] rendering...");
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: outputPath,
  inputProps: props,
  concurrency: 2,
  onProgress: ({ progress }) => {
    process.stdout.write(`\r[remotion] ${(progress * 100).toFixed(0)}%`);
  },
});

console.log("\n[remotion] done →", outputPath);
