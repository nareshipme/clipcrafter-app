"use client";

import React, { useEffect, useRef } from "react";

export interface ClipCaption {
  start: number; // seconds relative to clip start
  end: number;
  text: string;
}

interface ClipVideoPlayerProps {
  videoSrc: string;
  startSec: number;
  endSec: number;
  captions: ClipCaption[];
  captionPosition: "top" | "center" | "bottom";
  captionSize: "sm" | "md" | "lg";
  /** Absolute video time in seconds */
  currentTime: number;
  onTimeUpdate: (absoluteTime: number) => void;
  onDurationLoaded?: (videoDuration: number) => void;
}

const CAPTION_SIZE_CLASS: Record<string, string> = {
  sm: "text-sm leading-snug",
  md: "text-base leading-snug",
  lg: "text-xl leading-snug",
};

const CAPTION_POSITION_CLASS: Record<string, string> = {
  top: "top-6 items-start",
  center: "top-1/2 -translate-y-1/2 items-center",
  bottom: "bottom-6 items-end",
};

export function ClipVideoPlayer({
  videoSrc,
  startSec,
  endSec,
  captions,
  captionPosition,
  captionSize,
  currentTime,
  onTimeUpdate,
  onDurationLoaded,
}: ClipVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Track the last time we emitted to avoid feedback loops
  const lastEmittedRef = useRef<number>(-1);

  // Sync external currentTime → video (only seek if difference is significant)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const diff = Math.abs(video.currentTime - currentTime);
    if (diff > 0.3) {
      video.currentTime = Math.max(startSec, Math.min(endSec, currentTime));
      lastEmittedRef.current = currentTime;
    }
  }, [currentTime, startSec, endSec]);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    // Stop playback at endSec
    if (t >= endSec) {
      video.pause();
      video.currentTime = endSec;
      if (lastEmittedRef.current !== endSec) {
        lastEmittedRef.current = endSec;
        onTimeUpdate(endSec);
      }
      return;
    }
    if (Math.abs(t - lastEmittedRef.current) > 0.05) {
      lastEmittedRef.current = t;
      onTimeUpdate(t);
    }
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    onDurationLoaded?.(video.duration);
    video.currentTime = startSec;
  }

  // Active caption: relative to clip start (currentTime - startSec)
  const clipRelative = Math.max(0, currentTime - startSec);
  const activeCaption = captions.find((c) => c.start <= clipRelative && clipRelative <= c.end);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
        controls
      />
      {activeCaption && (
        <div
          className={`absolute left-0 right-0 flex justify-center px-4 pointer-events-none ${CAPTION_POSITION_CLASS[captionPosition]}`}
        >
          <div
            className={`bg-black/60 text-white font-bold px-4 py-2 rounded-lg text-center max-w-[85%] ${CAPTION_SIZE_CLASS[captionSize]}`}
            style={{ textShadow: "0 1px 6px #000, 0 0 12px #000" }}
          >
            {activeCaption.text}
          </div>
        </div>
      )}
    </div>
  );
}
