"use client";

import React from "react";
import { Clip } from "./types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface PlayerSectionProps {
  isCompleted: boolean;
  artifacts: Record<string, { url: string; label: string; available: boolean }> | null;
  videoUrl: string | null;
  isYouTube: boolean;
  youTubeVideoId: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  sortedClips: Clip[] | null;
  selectedClipId: string | null;
  clips: Clip[] | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  isPreviewing: boolean;
  showCaptions: boolean;
  captionText: string | null;
  selectedClip: Clip | null;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onSetIsPlaying: (v: boolean) => void;
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHandleMouseDown: (e: React.MouseEvent, clipId: string, side: "start" | "end") => void;
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onToggleLoop: () => void;
  onPlayAll: () => void;
  onStopPreviewing: () => void;
  onToggleCaptions: () => void;
  onSetSelectedClipId: (id: string) => void;
  onSeekToClip: (clip: Clip) => void;
}

function clipBarColor(clip: Clip, isSelected: boolean): string {
  if (clip.status === "approved") return "bg-green-600/60";
  if (clip.status === "rejected") return "bg-gray-700/40";
  return isSelected ? "bg-violet-500/70" : "bg-violet-600/50";
}

function makeMouseEventFromTouch(touch: React.Touch): React.MouseEvent {
  return {
    clientX: touch.clientX,
    stopPropagation: () => {},
    preventDefault: () => {},
  } as unknown as React.MouseEvent;
}

function ClipHandle({
  clipId,
  side,
  onHandleMouseDown,
}: {
  clipId: string;
  side: "start" | "end";
  onHandleMouseDown: (e: React.MouseEvent, clipId: string, side: "start" | "end") => void;
}) {
  const posClass = side === "start" ? "left-0" : "right-0";
  return (
    <div
      className={`absolute ${posClass} top-0 bottom-0 w-6 cursor-ew-resize flex items-center justify-center touch-none`}
      onMouseDown={(e) => onHandleMouseDown(e, clipId, side)}
      onTouchStart={(e) => {
        e.stopPropagation();
        onHandleMouseDown(makeMouseEventFromTouch(e.touches[0]), clipId, side);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-1.5 h-8 bg-white/80 rounded-full" />
    </div>
  );
}

function TimelineScrubber({
  timelineRef,
  sortedClips,
  selectedClipId,
  duration,
  currentTime,
  onTimelineClick,
  onHandleMouseDown,
  onSetSelectedClipId,
  onSeekToClip,
}: {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  sortedClips: Clip[] | null;
  selectedClipId: string | null;
  duration: number;
  currentTime: number;
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
        duration > 0 &&
        sortedClips.map((clip) => {
          const left = (clip.start_sec / duration) * 100;
          const width = ((clip.end_sec - clip.start_sec) / duration) * 100;
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
              <ClipHandle clipId={clip.id} side="start" onHandleMouseDown={onHandleMouseDown} />
              <ClipHandle clipId={clip.id} side="end" onHandleMouseDown={onHandleMouseDown} />
            </div>
          );
        })}
      {duration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white z-20 pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      )}
      <div className="absolute bottom-1 left-2 text-xs text-gray-600 font-mono pointer-events-none">
        {formatTime(currentTime)}
      </div>
      <div className="absolute bottom-1 right-2 text-xs text-gray-600 font-mono pointer-events-none">
        {formatTime(duration)}
      </div>
    </div>
  );
}

function TransportButtons({
  isPlaying,
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
}: {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onSkipPrev}
        aria-label="Previous clip"
        className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        {isPlaying ? (
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
        onClick={onSkipNext}
        aria-label="Next clip"
        className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm2.5-6l5.5-3.9v7.8L8.5 12zM16 6h2v12h-2z" />
        </svg>
      </button>
    </>
  );
}

function PlayButtonRow({
  isPlaying,
  isLooping,
  isPreviewing,
  currentTime,
  duration,
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onToggleLoop,
  onPlayAll,
  onStopPreviewing,
}: {
  isPlaying: boolean;
  isLooping: boolean;
  isPreviewing: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onToggleLoop: () => void;
  onPlayAll: () => void;
  onStopPreviewing: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <TransportButtons
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onSkipPrev={onSkipPrev}
        onSkipNext={onSkipNext}
      />
      <span className="text-xs text-gray-400 font-mono ml-1">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onToggleLoop}
        aria-label="Loop"
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isLooping ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
      >
        🔁 Loop
      </button>
      {isPreviewing ? (
        <button
          type="button"
          onClick={onStopPreviewing}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors"
        >
          ⏹ Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={onPlayAll}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          ▶ Play All
        </button>
      )}
    </div>
  );
}

function CaptionStatusRow({
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

function VideoDisplay({
  videoRef,
  videoUrl,
  isYouTube,
  youTubeVideoId,
  selectedClipId,
  clips,
  captionText,
  onTimeUpdate,
  onLoadedMetadata,
  onSetIsPlaying,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  isYouTube: boolean;
  youTubeVideoId: string | null;
  selectedClipId: string | null;
  clips: Clip[] | null;
  captionText: string | null;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onSetIsPlaying: (v: boolean) => void;
}) {
  return (
    <div className="relative bg-black flex-1 min-h-0 flex items-center justify-center">
      {isYouTube && youTubeVideoId ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${youTubeVideoId}?enablejsapi=1&rel=0`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {selectedClipId &&
            clips &&
            (() => {
              const c = clips.find((x) => x.id === selectedClipId);
              return c ? (
                <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
                  Clip: {formatTime(c.start_sec)} → {formatTime(c.end_sec)}
                </div>
              ) : null;
            })()}
          <div className="absolute bottom-3 left-3 bg-black/70 text-yellow-400 text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
            📺 YouTube — use the seek bar to navigate to clip timestamps
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-h-full max-w-full"
            playsInline
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onPlay={() => onSetIsPlaying(true)}
            onPause={() => onSetIsPlaying(false)}
          />
          {captionText && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center px-6 pointer-events-none">
              <span className="bg-black/75 text-white text-sm font-medium px-3 py-1.5 rounded-lg text-center max-w-lg">
                {captionText}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getPlayerGuardContent(
  isCompleted: boolean,
  artifacts: Record<string, { url: string; label: string; available: boolean }> | null,
  videoUrl: string | null
): React.ReactNode | null {
  if (!isCompleted)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-sm">Video player available once processing completes.</p>
      </div>
    );
  if (artifacts && artifacts.video && !artifacts.video.available)
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-sm">No video available for this project.</p>
      </div>
    );
  if (!videoUrl)
    return (
      <div className="flex-1 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-violet-500 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
          <path
            strokeLinecap="round"
            d="M4 12a8 8 0 018-8"
            strokeWidth="4"
            className="opacity-75"
          />
        </svg>
      </div>
    );
  return null;
}

type PlayerReadyProps = Omit<PlayerSectionProps, "isCompleted" | "artifacts"> & {
  videoUrl: string;
};

function PlayerReadyContent(p: PlayerReadyProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <VideoDisplay
        videoRef={p.videoRef}
        videoUrl={p.videoUrl}
        isYouTube={p.isYouTube}
        youTubeVideoId={p.youTubeVideoId}
        selectedClipId={p.selectedClipId}
        clips={p.clips}
        captionText={p.captionText}
        onTimeUpdate={p.onTimeUpdate}
        onLoadedMetadata={p.onLoadedMetadata}
        onSetIsPlaying={p.onSetIsPlaying}
      />
      {!p.isYouTube && (
        <TimelineScrubber
          timelineRef={p.timelineRef}
          sortedClips={p.sortedClips}
          selectedClipId={p.selectedClipId}
          duration={p.duration}
          currentTime={p.currentTime}
          onTimelineClick={p.onTimelineClick}
          onHandleMouseDown={p.onHandleMouseDown}
          onSetSelectedClipId={p.onSetSelectedClipId}
          onSeekToClip={p.onSeekToClip}
        />
      )}
      {!p.isYouTube && (
        <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex flex-col gap-2">
          <PlayButtonRow
            isPlaying={p.isPlaying}
            isLooping={p.isLooping}
            isPreviewing={p.isPreviewing}
            currentTime={p.currentTime}
            duration={p.duration}
            onTogglePlay={p.onTogglePlay}
            onSkipPrev={p.onSkipPrev}
            onSkipNext={p.onSkipNext}
            onToggleLoop={p.onToggleLoop}
            onPlayAll={p.onPlayAll}
            onStopPreviewing={p.onStopPreviewing}
          />
          <CaptionStatusRow
            showCaptions={p.showCaptions}
            selectedClip={p.selectedClip}
            onToggleCaptions={p.onToggleCaptions}
          />
        </div>
      )}
    </div>
  );
}

export function PlayerSection({ isCompleted, artifacts, videoUrl, ...rest }: PlayerSectionProps) {
  const guard = getPlayerGuardContent(isCompleted, artifacts, videoUrl);
  if (guard !== null) return guard;

  return <PlayerReadyContent videoUrl={videoUrl as string} {...rest} />;
}
