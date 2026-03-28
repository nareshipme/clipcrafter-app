"use client";

import React, { useState } from "react";
import { Clip, CaptionStyle, Segment } from "./types";
import { ClipTimingEditor, ClipTopicEditor } from "./ClipEditControls";

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-500 text-white";
  if (score >= 40) return "bg-yellow-500 text-black";
  return "bg-red-500 text-white";
}

export function ScoreBadge({ score }: { score: number }) {
  const display = score === 0 ? "—" : String(score);
  const colorClass = score === 0 ? "bg-gray-700 text-gray-400" : scoreColor(score);
  return (
    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {display}
    </span>
  );
}

function ClipExportControl({ clip, onExport }: { clip: Clip; onExport: (clipId: string) => void }) {
  if (clip.status === "exported" && clip.export_url) {
    return (
      <a
        href={clip.export_url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="ml-auto px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold text-white transition-colors min-h-[44px] flex items-center"
      >
        ↓ Download
      </a>
    );
  }
  if (clip.status === "exporting") {
    return (
      <span className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 min-h-[44px]">
        <svg
          className="w-3.5 h-3.5 animate-spin"
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
        Exporting…
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label="Export clip"
      onClick={() => onExport(clip.id)}
      className="ml-auto px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-xs font-semibold text-white transition-colors min-h-[44px]"
    >
      Export →
    </button>
  );
}

const SPEAKER_COLORS = [
  "text-violet-400",
  "text-blue-400",
  "text-green-400",
  "text-yellow-400",
  "text-pink-400",
];

function ClipTranscript({ segments }: { segments: Segment[] }) {
  return (
    <div
      className="bg-gray-900 rounded-lg p-3 mt-2 max-h-[200px] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1.5">
        {segments.map((seg) => {
          const m = seg.text.match(/^\[Speaker (\d+)\]\s*/);
          const speakerNum = m ? parseInt(m[1]) : null;
          const text = m ? seg.text.slice(m[0].length) : seg.text;
          const color =
            speakerNum !== null
              ? SPEAKER_COLORS[speakerNum % SPEAKER_COLORS.length]
              : "text-gray-400";
          const mm = Math.floor(seg.start / 60);
          const ss = Math.floor(seg.start % 60);
          const ts = `${mm}:${String(ss).padStart(2, "0")}`;
          return (
            <div key={seg.id} className="flex gap-2 text-xs leading-relaxed">
              <span className="text-gray-600 font-mono shrink-0 w-9">{ts}</span>
              {speakerNum !== null && (
                <span className={`font-bold shrink-0 w-5 ${color}`}>S{speakerNum}</span>
              )}
              <span className="text-gray-400">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ClipCardProps {
  clip: Clip;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (clipId: string) => void;
  onSeekToClip: (clip: Clip) => void;
  onToggleCheck: (clipId: string, checked: boolean) => void;
  onClipAction: (
    clipId: string,
    update: Partial<
      Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">
    >
  ) => void;
  onExportClip: (clipId: string) => void;
  transcriptSegments?: Segment[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onUpdateTopicLabel?: (original: string, newLabel: string) => void;
  topicOverrides?: Record<string, string>;
}

function ClipTimingRow({
  clip,
  videoRef,
  onClipAction,
}: {
  clip: Clip;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onClipAction: ClipCardProps["onClipAction"];
}) {
  const [trimOpen, setTrimOpen] = useState(false);
  const dur = clip.duration_sec?.toFixed(1) ?? (clip.end_sec - clip.start_sec).toFixed(1);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-mono flex-1">
          {formatTime(clip.start_sec)} → {formatTime(clip.end_sec)} · {dur}s
        </span>
        {videoRef && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTrimOpen((o) => !o);
            }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
          >
            ✂️ Trim {trimOpen ? "▴" : "▾"}
          </button>
        )}
      </div>
      {trimOpen && videoRef && (
        <div className="mt-2">
          <ClipTimingEditor clip={clip} videoRef={videoRef} onClipAction={onClipAction} />
        </div>
      )}
    </div>
  );
}

function ClipActions({
  clip,
  onClipAction,
  onExportClip,
}: {
  clip: Clip;
  onClipAction: ClipCardProps["onClipAction"];
  onExportClip: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Keep clip"
        onClick={() =>
          onClipAction(clip.id, { status: clip.status === "approved" ? "pending" : "approved" })
        }
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${clip.status === "approved" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-green-700 hover:text-white"}`}
      >
        {clip.status === "approved" ? "✓ Kept" : "Keep"}
      </button>
      <button
        type="button"
        aria-label="Skip clip"
        onClick={() =>
          onClipAction(clip.id, { status: clip.status === "rejected" ? "pending" : "rejected" })
        }
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${clip.status === "rejected" ? "bg-red-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-red-800 hover:text-white"}`}
      >
        {clip.status === "rejected" ? "✗ Skipped" : "Skip"}
      </button>
      <ClipExportControl clip={clip} onExport={onExportClip} />
    </div>
  );
}

function ClipExportSettings({
  clip,
  onClipAction,
}: {
  clip: Clip;
  onClipAction: ClipCardProps["onClipAction"];
}) {
  if (clip.status !== "approved") return null;
  return (
    <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-xs text-gray-500">Caption:</span>
      <select
        aria-label="Caption style"
        value={clip.caption_style}
        onChange={(e) => onClipAction(clip.id, { caption_style: e.target.value as CaptionStyle })}
        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-1.5 py-1"
      >
        <option value="hormozi">Hormozi</option>
        <option value="modern">Modern</option>
        <option value="neon">Neon</option>
        <option value="minimal">Minimal</option>
      </select>
      <span className="text-xs text-gray-500 ml-2">Ratio:</span>
      <select
        aria-label="Aspect ratio"
        value={clip.aspect_ratio}
        onChange={(e) => onClipAction(clip.id, { aspect_ratio: e.target.value })}
        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-1.5 py-1"
      >
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
        <option value="16:9">16:9</option>
      </select>
    </div>
  );
}

function clipBorderClass(isSelected: boolean, status: Clip["status"]): string {
  if (isSelected) return "border-l-4 border-l-violet-500 border-gray-700";
  if (status === "approved") return "border-l-4 border-l-green-500 border-gray-800";
  return "border-gray-800 hover:border-gray-700";
}

function ClipHashtags({ hashtags }: { hashtags: string[] }) {
  const visible = hashtags.slice(0, 2);
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {visible.map((tag) => (
        <span key={tag} className="text-xs bg-gray-800 text-violet-400 px-2 py-0.5 rounded-full">
          {tag}
        </span>
      ))}
    </div>
  );
}

function ClipFooter({
  clip,
  clipSegments,
  onClipAction,
  onExportClip,
}: {
  clip: Clip;
  clipSegments: Segment[];
  onClipAction: ClipCardProps["onClipAction"];
  onExportClip: (id: string) => void;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  return (
    <>
      <ClipActions clip={clip} onClipAction={onClipAction} onExportClip={onExportClip} />
      <ClipExportSettings clip={clip} onClipAction={onClipAction} />
      {clipSegments.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTranscriptOpen((o) => !o);
            }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
          >
            📝 Transcript {transcriptOpen ? "▴" : "▾"}
          </button>
          {transcriptOpen && <ClipTranscript segments={clipSegments} />}
        </div>
      )}
    </>
  );
}

function ClipTopicBadge({
  topic,
  topicOverrides,
  onUpdateTopicLabel,
}: {
  topic: string;
  topicOverrides?: Record<string, string>;
  onUpdateTopicLabel?: (original: string, newLabel: string) => void;
}) {
  const displayTopic = topicOverrides?.[topic] ?? topic;
  if (onUpdateTopicLabel) {
    return (
      <ClipTopicEditor
        topic={displayTopic}
        originalTopic={topic}
        onUpdateTopicLabel={onUpdateTopicLabel}
      />
    );
  }
  return (
    <span className="text-xs bg-violet-900/50 text-violet-300 border border-violet-700/50 px-2 py-0.5 rounded-full">
      🏷 {displayTopic}
    </span>
  );
}

export function ClipCard({
  clip,
  isSelected,
  isChecked,
  onSelect,
  onSeekToClip,
  onToggleCheck,
  onClipAction,
  onExportClip,
  transcriptSegments,
  videoRef,
  onUpdateTopicLabel,
  topicOverrides,
}: ClipCardProps) {
  const clipSegments =
    transcriptSegments?.filter((s) => s.end > clip.start_sec && s.start < clip.end_sec) ?? [];
  return (
    <div
      onClick={() => {
        onSelect(clip.id);
        onSeekToClip(clip);
      }}
      className={`relative bg-gray-900 border rounded-xl p-4 transition-all cursor-pointer ${clipBorderClass(isSelected, clip.status)}`}
    >
      <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="w-4 h-4 accent-violet-500 cursor-pointer"
          checked={isChecked}
          onChange={(e) => onToggleCheck(clip.id, e.target.checked)}
        />
      </div>
      {clip.topic && (
        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
          <ClipTopicBadge
            topic={clip.topic}
            topicOverrides={topicOverrides}
            onUpdateTopicLabel={onUpdateTopicLabel}
          />
        </div>
      )}
      <div className="flex items-start gap-2 mb-2">
        <ScoreBadge score={clip.score} />
        <p className="text-violet-300 text-sm font-semibold flex-1 min-w-0 line-clamp-2">
          {clip.clip_title ?? clip.title ?? "Untitled clip"}
        </p>
      </div>
      <div className="mb-2">
        <ClipTimingRow clip={clip} videoRef={videoRef} onClipAction={onClipAction} />
      </div>
      {clip.hashtags?.length > 0 && <ClipHashtags hashtags={clip.hashtags} />}
      <ClipFooter
        clip={clip}
        clipSegments={clipSegments}
        onClipAction={onClipAction}
        onExportClip={onExportClip}
      />
    </div>
  );
}

export function SkippedClipCard({
  clip,
  onRestore,
}: {
  clip: Clip;
  onRestore: (clipId: string) => void;
}) {
  const dur = clip.duration_sec?.toFixed(1) ?? (clip.end_sec - clip.start_sec).toFixed(1);
  return (
    <article className="relative bg-gray-900 border border-gray-800 rounded-xl p-4">
      {clip.topic && (
        <div className="mb-2">
          <span className="text-xs bg-violet-900/50 text-violet-300 border border-violet-700/50 px-2 py-0.5 rounded-full">
            🏷 {clip.topic}
          </span>
        </div>
      )}
      <div className="flex items-start gap-2 mb-2">
        <ScoreBadge score={clip.score} />
        <p className="text-gray-400 text-sm font-semibold flex-1 min-w-0 line-clamp-2">
          {clip.clip_title ?? clip.title ?? "Untitled clip"}
        </p>
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500 font-mono">
        <span>
          {formatTime(clip.start_sec)} → {formatTime(clip.end_sec)}
        </span>
        <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">{dur}s</span>
      </div>
      <button
        type="button"
        aria-label={`Restore clip: ${clip.clip_title ?? clip.title ?? "Untitled clip"}`}
        onClick={() => onRestore(clip.id)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] bg-gray-800 text-gray-300 hover:bg-violet-700 hover:text-white"
      >
        ↩ Restore
      </button>
    </article>
  );
}
