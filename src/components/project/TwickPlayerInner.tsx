"use client";

/**
 * TwickPlayerInner — browser-only Twick integration.
 * Dynamically imported (ssr: false) by TwickPlayerSection.
 *
 * What works:
 *  - LivePlayer renders the R2 video URL via projectData
 *  - Local time/duration state driven by LivePlayer callbacks
 *  - Custom scrubber driven from local time (parent videoRef not used)
 *  - Transport controls (play/pause/skip/loop) wired to parent callbacks
 *
 * Not yet working:
 *  - Seek-to-clip: parent's onSeekToClip mutates videoRef.current.currentTime,
 *    which has no effect with LivePlayer. Need useLivePlayerContext().seekTo()
 *    once the context API surface is confirmed.
 *  - Trim handle dragging: onHandleMouseDown drives parent state that ultimately
 *    also calls videoRef.current — same gap as above.
 *  - @twick/timeline: the package is a programmatic data-editing API (TimelineEditor,
 *    VideoElement, …), not a drop-in visual scrubber. The custom scrubber below
 *    stays until a visual timeline component is confirmed available.
 */

import React, { useState, useCallback, useMemo } from "react";
import { LivePlayer } from "@twick/live-player";
import type { PlayerSectionProps } from "./PlayerSection";
import type { Clip } from "./types";

type Props = Omit<PlayerSectionProps, "isCompleted" | "artifacts"> & {
  videoUrl: string;
};

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clipBarColor(clip: Clip, isSelected: boolean): string {
  if (clip.status === "approved") return "bg-green-600/60";
  if (clip.status === "rejected") return "bg-gray-700/40";
  return isSelected ? "bg-violet-500/70" : "bg-violet-600/50";
}

function buildProjectData(videoUrl: string, duration: number) {
  return {
    input: {
      properties: { width: 1920, height: 1080 },
      timeline: [
        {
          id: "t-main-video",
          type: "element",
          name: "video",
          elements: [
            {
              id: "e-main-video",
              type: "video",
              s: 0,
              e: duration > 0 ? duration : 3600, // fall back to 1 h until LivePlayer reports real duration
              props: { src: videoUrl, width: 1920, height: 1080 },
            },
          ],
        },
      ],
    },
    version: 1,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function YoutubeDisplay({
  youTubeVideoId,
  selectedClipId,
  clips,
}: {
  youTubeVideoId: string;
  selectedClipId: string | null;
  clips: Clip[] | null;
}) {
  const selectedClip = clips?.find((x) => x.id === selectedClipId);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${youTubeVideoId}?enablejsapi=1&rel=0`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      {selectedClip && (
        <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
          Clip: {formatTime(selectedClip.start_sec)} → {formatTime(selectedClip.end_sec)}
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/70 text-yellow-400 text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
        📺 YouTube — use the seek bar to navigate to clip timestamps
      </div>
    </div>
  );
}

function TwickScrubber({
  timelineRef,
  sortedClips,
  selectedClipId,
  displayTime,
  displayDuration,
  onTimelineClick,
  onHandleMouseDown,
  onSetSelectedClipId,
  onSeekToClip,
}: {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  sortedClips: Clip[] | null;
  selectedClipId: string | null;
  displayTime: number;
  displayDuration: number;
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHandleMouseDown: (e: React.MouseEvent, clipId: string, side: "start" | "end") => void;
  onSetSelectedClipId: (id: string) => void;
  onSeekToClip: (clip: Clip) => void;
}) {
  return (
    <div
      ref={timelineRef}
      className="relative h-20 bg-gray-900 border-t border-gray-800 cursor-pointer shrink-0"
      onClick={onTimelineClick}
    >
      {sortedClips &&
        displayDuration > 0 &&
        sortedClips.map((clip) => {
          const left = (clip.start_sec / displayDuration) * 100;
          const width = ((clip.end_sec - clip.start_sec) / displayDuration) * 100;
          const isSel = clip.id === selectedClipId;
          return (
            <div
              key={clip.id}
              className={`absolute top-2 bottom-2 rounded ${clipBarColor(clip, isSel)} ${isSel ? "z-10" : "z-0"}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSetSelectedClipId(clip.id);
                onSeekToClip(clip);
              }}
            >
              {(["start", "end"] as const).map((side) => (
                <div
                  key={side}
                  className={`absolute ${side === "start" ? "left-0" : "right-0"} top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center touch-none`}
                  onMouseDown={(e) => onHandleMouseDown(e, clip.id, side)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-1.5 h-8 bg-white/80 rounded-full" />
                </div>
              ))}
            </div>
          );
        })}
      {displayDuration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white z-20 pointer-events-none"
          style={{ left: `${(displayTime / displayDuration) * 100}%` }}
        />
      )}
      <div className="absolute bottom-1 left-2 text-xs text-gray-600 font-mono pointer-events-none">
        {formatTime(displayTime)}
      </div>
      <div className="absolute bottom-1 right-2 text-xs text-gray-600 font-mono pointer-events-none">
        {formatTime(displayDuration)}
      </div>
    </div>
  );
}

type TransportRowProps = {
  isPlaying: boolean;
  isLooping: boolean;
  isPreviewing: boolean;
  displayTime: number;
  displayDuration: number;
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onToggleLoop: () => void;
  onPlayAll: () => void;
  onStopPreviewing: () => void;
};

function TransportRow(p: TransportRowProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={p.onSkipPrev}
        aria-label="Previous clip"
        className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={p.onTogglePlay}
        aria-label={p.isPlaying ? "Pause" : "Play"}
        className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        {p.isPlaying ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={p.onSkipNext}
        aria-label="Next clip"
        className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm2.5-6l5.5-3.9v7.8L8.5 12zM16 6h2v12h-2z" />
        </svg>
      </button>
      <span className="text-xs text-gray-400 font-mono ml-1">
        {formatTime(p.displayTime)} / {formatTime(p.displayDuration)}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={p.onToggleLoop}
        aria-label="Loop"
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${p.isLooping ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
      >
        🔁 Loop
      </button>
      {p.isPreviewing ? (
        <button
          type="button"
          onClick={p.onStopPreviewing}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors"
        >
          ⏹ Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={p.onPlayAll}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ▶ Play All
        </button>
      )}
    </div>
  );
}

function CaptionsRow({
  showCaptions,
  selectedClip,
  onToggleCaptions,
}: {
  showCaptions: boolean;
  selectedClip: Clip | null;
  onToggleCaptions: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggleCaptions}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showCaptions ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
      >
        Captions {showCaptions ? "On" : "Off"}
      </button>
      {selectedClip && (
        <span className="text-xs text-gray-500 truncate">
          {selectedClip.clip_title ?? selectedClip.title ?? "Untitled clip"}
        </span>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TwickPlayerInner(p: Props) {
  const { onTimeUpdate, onLoadedMetadata } = p;
  const [localTime, setLocalTime] = useState(p.currentTime);
  const [localDuration, setLocalDuration] = useState(p.duration);

  const projectData = useMemo(
    () => buildProjectData(p.videoUrl, localDuration),
    [p.videoUrl, localDuration]
  );

  const handleTimeUpdate = useCallback(
    (time: number) => {
      setLocalTime(time);
      onTimeUpdate();
    },
    [onTimeUpdate]
  );

  const handleDurationChange = useCallback(
    (dur: number) => {
      setLocalDuration(dur);
      onLoadedMetadata();
    },
    [onLoadedMetadata]
  );

  const displayTime = localTime;
  const displayDuration = localDuration > 0 ? localDuration : p.duration;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="relative bg-black flex-1 min-h-0 flex items-center justify-center">
        {p.isYouTube && p.youTubeVideoId ? (
          <YoutubeDisplay
            youTubeVideoId={p.youTubeVideoId}
            selectedClipId={p.selectedClipId}
            clips={p.clips}
          />
        ) : (
          <>
            <LivePlayer
              projectData={projectData}
              videoSize={{ width: 1920, height: 1080 }}
              playing={p.isPlaying}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
            />
            {p.captionText && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center px-6 pointer-events-none">
                <span className="bg-black/75 text-white text-sm font-medium px-3 py-1.5 rounded-lg text-center max-w-lg">
                  {p.captionText}
                </span>
              </div>
            )}
          </>
        )}
      </div>
      {!p.isYouTube && (
        <TwickScrubber
          timelineRef={p.timelineRef}
          sortedClips={p.sortedClips}
          selectedClipId={p.selectedClipId}
          displayTime={displayTime}
          displayDuration={displayDuration}
          onTimelineClick={p.onTimelineClick}
          onHandleMouseDown={p.onHandleMouseDown}
          onSetSelectedClipId={p.onSetSelectedClipId}
          onSeekToClip={p.onSeekToClip}
        />
      )}
      {!p.isYouTube && (
        <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex flex-col gap-2">
          <TransportRow
            isPlaying={p.isPlaying}
            isLooping={p.isLooping}
            isPreviewing={p.isPreviewing}
            displayTime={displayTime}
            displayDuration={displayDuration}
            onTogglePlay={p.onTogglePlay}
            onSkipPrev={p.onSkipPrev}
            onSkipNext={p.onSkipNext}
            onToggleLoop={p.onToggleLoop}
            onPlayAll={p.onPlayAll}
            onStopPreviewing={p.onStopPreviewing}
          />
          <CaptionsRow
            showCaptions={p.showCaptions}
            selectedClip={p.selectedClip}
            onToggleCaptions={p.onToggleCaptions}
          />
        </div>
      )}
    </div>
  );
}
