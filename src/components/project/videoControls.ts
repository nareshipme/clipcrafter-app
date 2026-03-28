"use client";

import { toast } from "sonner";
import { Clip } from "./types";

interface VideoRefs {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  dragStateRef: React.MutableRefObject<{ clipId: string; side: "start" | "end" } | null>;
  durationRef: React.MutableRefObject<number>;
  isLoopingRef: React.MutableRefObject<boolean>;
  isPreviewingRef: React.MutableRefObject<boolean>;
  clipsRef: React.MutableRefObject<Clip[] | null>;
  selectedClipIdRef: React.MutableRefObject<string | null>;
  previewClipIndexRef: React.MutableRefObject<number>;
  previewClipsRef: React.MutableRefObject<Clip[]>;
}

interface VideoSetters {
  setCurrentTime: (t: number) => void;
  setSelectedClipId: (id: string | null) => void;
  setIsPreviewing: (v: boolean) => void;
  setDuration: (d: number) => void;
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>;
}

export function makeSeekToClip(videoRef: React.RefObject<HTMLVideoElement | null>) {
  return function seekToClip(clip: Clip) {
    if (videoRef.current) {
      videoRef.current.currentTime = clip.start_sec;
      videoRef.current.play();
    }
  };
}

export function makeTogglePlay(videoRef: React.RefObject<HTMLVideoElement | null>) {
  return function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };
}

export function makeSkipTo(
  refs: Pick<VideoRefs, "clipsRef" | "selectedClipIdRef" | "videoRef">,
  setSelectedClipId: (id: string | null) => void
) {
  function seekToClip(clip: Clip) {
    if (refs.videoRef.current) {
      refs.videoRef.current.currentTime = clip.start_sec;
      refs.videoRef.current.play();
    }
  }
  return function skipTo(direction: "prev" | "next") {
    if (!refs.clipsRef.current || !refs.selectedClipIdRef.current) return;
    const sorted = [...refs.clipsRef.current].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex((c) => c.id === refs.selectedClipIdRef.current);
    const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < sorted.length) {
      setSelectedClipId(sorted[targetIdx].id);
      seekToClip(sorted[targetIdx]);
    }
  };
}

interface PlayAllArgs {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clips: Clip[] | null;
  previewClipsRef: React.MutableRefObject<Clip[]>;
  previewClipIndexRef: React.MutableRefObject<number>;
  setIsPreviewing: (v: boolean) => void;
  setSelectedClipId: (id: string | null) => void;
}

export function makeHandlePlayAll(args: PlayAllArgs) {
  const {
    videoRef,
    clips,
    previewClipsRef,
    previewClipIndexRef,
    setIsPreviewing,
    setSelectedClipId,
  } = args;
  return function handlePlayAll() {
    if (!clips || clips.length === 0 || !videoRef.current) return;
    const sorted = [
      ...clips.filter((c) => c.status === "approved").sort((a, b) => b.score - a.score),
      ...clips.filter((c) => c.status !== "approved").sort((a, b) => b.score - a.score),
    ];
    previewClipsRef.current = sorted;
    previewClipIndexRef.current = 0;
    setIsPreviewing(true);
    setSelectedClipId(sorted[0].id);
    videoRef.current.currentTime = sorted[0].start_sec;
    videoRef.current.play();
  };
}

export function makeHandleTimeUpdate(refs: VideoRefs, setters: VideoSetters) {
  function advancePreview(t: number) {
    if (!refs.videoRef.current) return;
    const previewClips = refs.previewClipsRef.current;
    const idx = refs.previewClipIndexRef.current;
    if (idx >= previewClips.length || t < previewClips[idx].end_sec) return;
    const nextIdx = idx + 1;
    if (nextIdx < previewClips.length) {
      refs.previewClipIndexRef.current = nextIdx;
      setters.setSelectedClipId(previewClips[nextIdx].id);
      refs.videoRef.current.currentTime = previewClips[nextIdx].start_sec;
    } else {
      setters.setIsPreviewing(false);
      refs.videoRef.current.pause();
    }
  }

  return function handleTimeUpdate() {
    if (!refs.videoRef.current) return;
    const t = refs.videoRef.current.currentTime;
    setters.setCurrentTime(t);
    if (refs.isLoopingRef.current && refs.selectedClipIdRef.current && refs.clipsRef.current) {
      const clip = refs.clipsRef.current.find((c) => c.id === refs.selectedClipIdRef.current);
      if (clip && t >= clip.end_sec) {
        refs.videoRef.current.currentTime = clip.start_sec;
        return;
      }
    }
    if (refs.isPreviewingRef.current) advancePreview(t);
  };
}

export function makeHandleTimelineClick(
  timelineRef: React.RefObject<HTMLDivElement | null>,
  durationRef: React.MutableRefObject<number>,
  dragStateRef: React.MutableRefObject<{ clipId: string; side: "start" | "end" } | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  return function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || durationRef.current === 0 || dragStateRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = ratio * durationRef.current;
  };
}

interface DragRefs {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  durationRef: React.MutableRefObject<number>;
  dragStateRef: React.MutableRefObject<{ clipId: string; side: "start" | "end" } | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clipsRef: React.MutableRefObject<Clip[] | null>;
}

export function makeHandleHandleMouseDown(
  refs: DragRefs,
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>
) {
  const { timelineRef, durationRef, dragStateRef, videoRef, clipsRef } = refs;
  return function handleHandleMouseDown(
    e: React.MouseEvent,
    clipId: string,
    side: "start" | "end"
  ) {
    e.stopPropagation();
    e.preventDefault();
    dragStateRef.current = { clipId, side };

    // Initialize dragValue to the clip's current boundary — so a click without drag
    // doesn't reset the value to 0 on mouseup
    const currentClipInitial = clipsRef.current?.find((c) => c.id === clipId);
    let dragValue = currentClipInitial
      ? side === "start"
        ? currentClipInitial.start_sec
        : currentClipInitial.end_sec
      : 0;
    let lastSeekMs = 0;

    function onMouseMove(ev: MouseEvent) {
      if (!dragStateRef.current || !timelineRef.current || durationRef.current === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      dragValue =
        Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * durationRef.current;

      // Debounced video seek: at most once every 100ms
      const now = Date.now();
      if (videoRef.current && now - lastSeekMs >= 100) {
        videoRef.current.currentTime = dragValue;
        lastSeekMs = now;
      }
    }

    function onMouseUp() {
      if (!dragStateRef.current) return;
      const { clipId: cId, side: dragSide } = dragStateRef.current;
      dragStateRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      // Clamp against the clip's opposing boundary
      const currentClip = clipsRef.current?.find((c) => c.id === cId);
      const patchValue = currentClip
        ? dragSide === "start"
          ? Math.min(dragValue, currentClip.end_sec - 0.5)
          : Math.max(dragValue, currentClip.start_sec + 0.5)
        : dragValue;

      // Commit to state once on mouseup
      setClips((prev) => {
        if (!prev) return prev;
        return prev.map((c) => {
          if (c.id !== cId) return c;
          return dragSide === "start"
            ? { ...c, start_sec: patchValue }
            : { ...c, end_sec: patchValue };
        });
      });

      // Single PATCH on mouseup
      const update = dragSide === "start" ? { start_sec: patchValue } : { end_sec: patchValue };
      fetch(`/api/clips/${cId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      }).catch(() => toast.error("Failed to save clip timing"));
    }

    function onTouchMove(ev: TouchEvent) {
      ev.preventDefault();
      const touch = ev.touches[0];
      onMouseMove({ clientX: touch.clientX } as MouseEvent);
    }

    function onTouchEnd() {
      onMouseUp();
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  };
}
