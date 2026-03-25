"use client";

import React from "react";
import { Clip, CaptionStyle } from "./types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-500 text-white";
  if (score >= 40) return "bg-yellow-500 text-black";
  return "bg-red-500 text-white";
}

function ScoreBadge({ score }: { score: number }) {
  const display = score === 0 ? "—" : String(score);
  const colorClass = score === 0 ? "bg-gray-700 text-gray-400" : scoreColor(score);
  return (
    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
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
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
      <select
        aria-label="Caption style"
        value={clip.caption_style}
        onChange={(e) => onClipAction(clip.id, { caption_style: e.target.value as CaptionStyle })}
        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[44px]"
      >
        <option value="hormozi">Hormozi</option>
        <option value="modern">Modern</option>
        <option value="neon">Neon</option>
        <option value="minimal">Minimal</option>
      </select>
      <select
        aria-label="Aspect ratio"
        value={clip.aspect_ratio}
        onChange={(e) => onClipAction(clip.id, { aspect_ratio: e.target.value })}
        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[44px]"
      >
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
        <option value="16:9">16:9</option>
      </select>
      <ClipExportControl clip={clip} onExport={onExportClip} />
    </div>
  );
}

interface ClipCardProps {
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
}

function clipBorderClass(isSelected: boolean, status: Clip["status"]): string {
  if (isSelected) return "border-l-4 border-l-violet-500 border-gray-700";
  if (status === "approved") return "border-l-4 border-l-green-500 border-gray-800";
  if (status === "rejected") return "border-gray-800 opacity-35";
  return "border-gray-800 hover:border-gray-700";
}

function ClipHashtags({ hashtags }: { hashtags: string[] }) {
  const visible = hashtags.slice(0, 3);
  const extra = hashtags.length - 3;
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {visible.map((tag) => (
        <span key={tag} className="text-xs bg-gray-800 text-violet-400 px-2 py-0.5 rounded-full">
          {tag}
        </span>
      ))}
      {extra > 0 && <span className="text-xs text-gray-500 px-2 py-0.5">+{extra} more</span>}
    </div>
  );
}

function ClipCard({
  clip,
  isSelected,
  isChecked,
  onSelect,
  onSeekToClip,
  onToggleCheck,
  onClipAction,
  onExportClip,
}: ClipCardProps) {
  const dur = clip.duration_sec?.toFixed(1) ?? (clip.end_sec - clip.start_sec).toFixed(1);
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
        <div className="mb-2">
          <span className="text-xs bg-violet-900/50 text-violet-300 border border-violet-700/50 px-2 py-0.5 rounded-full">
            🏷 {clip.topic}
          </span>
        </div>
      )}
      <div className="flex items-start gap-2 mb-2">
        <ScoreBadge score={clip.score} />
        <p className="text-violet-300 text-sm font-semibold flex-1 min-w-0 line-clamp-2">
          {clip.clip_title ?? clip.title ?? "Untitled clip"}
        </p>
      </div>
      <div className="flex items-center gap-3 mb-2 text-xs text-gray-400 font-mono">
        <span>
          {formatTime(clip.start_sec)} → {formatTime(clip.end_sec)}
        </span>
        <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{dur}s</span>
      </div>
      {clip.hashtags?.length > 0 && <ClipHashtags hashtags={clip.hashtags} />}
      <ClipActions clip={clip} onClipAction={onClipAction} onExportClip={onExportClip} />
    </div>
  );
}

function TopicFilterChips({
  clips,
  selectedTopic,
  onSetSelectedTopic,
}: {
  clips: Clip[] | null;
  selectedTopic: string | null;
  onSetSelectedTopic: (t: string | null) => void;
}) {
  const topics = [...new Set((clips ?? []).map((c) => c.topic).filter(Boolean) as string[])];
  if (topics.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onSetSelectedTopic(null)}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[32px] ${selectedTopic === null ? "bg-violet-600 border-violet-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
      >
        All ({clips?.length})
      </button>
      {topics.map((t) => {
        const count = clips?.filter((c) => c.topic === t).length ?? 0;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onSetSelectedTopic(selectedTopic === t ? null : t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[32px] ${selectedTopic === t ? "bg-violet-600 border-violet-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
          >
            {t} ({count})
          </button>
        );
      })}
    </div>
  );
}

function ExportBar({
  sortedClips,
  selectedClipIds,
  withCaptions,
  clips,
  allApproved,
  onSelectAll,
  onDeselectAll,
  onToggleCaptions,
  onExportBatch,
  onKeepAll,
}: {
  sortedClips: Clip[];
  selectedClipIds: Set<string>;
  withCaptions: boolean;
  clips: Clip[] | null;
  allApproved: boolean;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
  onToggleCaptions: () => void;
  onExportBatch: () => void;
  onKeepAll: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-gray-950 py-2 flex flex-wrap items-center gap-2 border-b border-gray-800 -mx-4 px-4">
      <button
        type="button"
        onClick={() => {
          if (selectedClipIds.size === sortedClips.length) onDeselectAll();
          else onSelectAll(sortedClips.map((c) => c.id));
        }}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:text-white transition-colors min-h-[30px]"
      >
        {selectedClipIds.size === sortedClips.length ? "Deselect All" : "Select All"}
      </button>
      <button
        type="button"
        onClick={onKeepAll}
        disabled={allApproved}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[30px]"
      >
        Keep All
      </button>
      <button
        type="button"
        onClick={onToggleCaptions}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors min-h-[30px] ${withCaptions ? "bg-green-700 text-green-100" : "bg-gray-700 text-gray-400"}`}
      >
        Caption: {withCaptions ? "ON" : "OFF"}
      </button>
      <button
        type="button"
        onClick={onExportBatch}
        disabled={
          selectedClipIds.size === 0 ||
          (clips?.some((c) => selectedClipIds.has(c.id) && c.status === "exporting") ?? false)
        }
        className="ml-auto px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors min-h-[36px]"
      >
        Export {selectedClipIds.size} clip{selectedClipIds.size !== 1 ? "s" : ""} ▶
      </button>
    </div>
  );
}

export interface ClipListViewProps {
  sortedClips: Clip[];
  selectedClipId: string | null;
  selectedClipIds: Set<string>;
  selectedTopic: string | null;
  clipsStatus: string;
  clips: Clip[] | null;
  withCaptions: boolean;
  onSetSelectedTopic: (t: string | null) => void;
  onSetSelectedClipId: (id: string) => void;
  onSeekToClip: (clip: Clip) => void;
  onToggleClipCheck: (clipId: string, checked: boolean) => void;
  onSelectAll: (allIds: string[]) => void;
  onDeselectAll: () => void;
  onToggleCaptions: () => void;
  onExportBatch: () => void;
  onClipAction: (
    clipId: string,
    update: Partial<
      Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">
    >
  ) => void;
  onExportClip: (clipId: string) => void;
  onGenerateClips: () => void;
}

export function ClipListView({
  sortedClips,
  selectedClipId,
  selectedClipIds,
  selectedTopic,
  clipsStatus,
  clips,
  withCaptions,
  onSetSelectedTopic,
  onSetSelectedClipId,
  onSeekToClip,
  onToggleClipCheck,
  onSelectAll,
  onDeselectAll,
  onToggleCaptions,
  onExportBatch,
  onClipAction,
  onExportClip,
  onGenerateClips,
}: ClipListViewProps) {
  const filteredClips = sortedClips.filter(
    (clip) => !selectedTopic || clip.topic === selectedTopic
  );
  return (
    <>
      <TopicFilterChips
        clips={clips}
        selectedTopic={selectedTopic}
        onSetSelectedTopic={onSetSelectedTopic}
      />
      {clipsStatus !== "generating" && sortedClips.length > 0 && (
        <ExportBar
          sortedClips={sortedClips}
          selectedClipIds={selectedClipIds}
          withCaptions={withCaptions}
          clips={clips}
          allApproved={sortedClips.every((c) => c.status === "approved")}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onToggleCaptions={onToggleCaptions}
          onExportBatch={onExportBatch}
          onKeepAll={() => {
            sortedClips.forEach((clip) => {
              if (clip.status !== "approved") onClipAction(clip.id, { status: "approved" });
            });
          }}
        />
      )}
      {clipsStatus !== "generating" && sortedClips.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isSelected={clip.id === selectedClipId}
              isChecked={selectedClipIds.has(clip.id)}
              onSelect={onSetSelectedClipId}
              onSeekToClip={onSeekToClip}
              onToggleCheck={onToggleClipCheck}
              onClipAction={onClipAction}
              onExportClip={onExportClip}
            />
          ))}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onGenerateClips}
              disabled={clipsStatus === "generating"}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
            >
              ↺ Regenerate Clips
            </button>
          </div>
        </div>
      )}
    </>
  );
}
