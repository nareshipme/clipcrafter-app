"use client";

import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { ClipComposition } from "@/remotion/ClipComposition";
import type { Caption } from "@remotion/captions";

export interface ClipRemotionPlayerInnerProps {
  videoSrc: string;
  startSec: number;
  endSec: number;
  captions: Array<{ start: number; end: number; text: string }>;
  captionPosition: "top" | "center" | "bottom";
  captionSize: "sm" | "md" | "lg";
  captionStyle?: "hormozi" | "modern" | "neon" | "minimal";
  aspectRatio: "9:16" | "16:9";
  cropMode?: "contain" | "cover" | "face" | "custom";
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
}

export function ClipRemotionPlayerInner({
  videoSrc,
  startSec,
  endSec,
  captions,
  captionPosition,
  captionSize,
  captionStyle = "hormozi",
  aspectRatio,
  cropMode = "cover",
  cropX = 50,
  cropY = 50,
  cropZoom = 1,
}: ClipRemotionPlayerInnerProps) {
  const fps = 30;
  const durationInFrames = Math.max(1, Math.round((endSec - startSec) * fps));

  const [compositionWidth, compositionHeight] =
    aspectRatio === "16:9" ? [1920, 1080] : [1080, 1920];

  // Captions from API are already 0-based (start=0 = clip start).
  // Remotion Caption type uses ms, composition time starts at 0.
  const remotionCaptions: Caption[] = useMemo(
    () =>
      captions.map((c) => ({
        text: c.text,
        startMs: c.start * 1000,
        endMs: c.end * 1000,
        timestampMs: c.start * 1000,
        confidence: 1,
      })),
    [captions]
  );

  return (
    <Player
      component={ClipComposition}
      inputProps={{
        videoSrc,
        startSec,
        endSec,
        captions: remotionCaptions,
        captionStyle,
        withCaptions: remotionCaptions.length > 0,
        captionPosition,
        captionSize,
        aspectRatio,
        cropMode,
        cropX,
        cropY,
        cropZoom,
      }}
      durationInFrames={durationInFrames}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      fps={fps}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "12px",
      }}
      controls
      clickToPlay
    />
  );
}
