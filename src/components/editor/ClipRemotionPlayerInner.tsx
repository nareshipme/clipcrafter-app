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
}: ClipRemotionPlayerInnerProps) {
  const fps = 30;
  const durationInFrames = Math.max(1, Math.round((endSec - startSec) * fps));

  const [compositionWidth, compositionHeight] =
    aspectRatio === "16:9" ? [1920, 1080] : [1080, 1920];

  // Convert clip-relative seconds → Remotion Caption format (absolute milliseconds)
  const remotionCaptions: Caption[] = useMemo(
    () =>
      captions.map((c) => ({
        text: c.text,
        startMs: (c.start + startSec) * 1000,
        endMs: (c.end + startSec) * 1000,
        timestampMs: (c.start + startSec) * 1000,
        confidence: 1,
      })),
    [captions, startSec]
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
      }}
      durationInFrames={durationInFrames}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      fps={fps}
      style={{
        width: "100%",
        borderRadius: "12px",
        aspectRatio: aspectRatio === "16:9" ? "16/9" : "9/16",
      }}
      controls
      clickToPlay
    />
  );
}
