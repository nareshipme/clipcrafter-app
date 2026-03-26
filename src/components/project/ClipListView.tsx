"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Clip } from "./types";
import { ClipCard, SkippedClipCard } from "./ClipCard";

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
  onStitchExport,
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
  onStitchExport?: () => void;
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
      {onStitchExport && selectedClipIds.size > 1 && (
        <button
          type="button"
          onClick={onStitchExport}
          className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-xs font-semibold text-white transition-colors min-h-[36px]"
        >
          Stitch & Export ({selectedClipIds.size})
        </button>
      )}
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

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  onOpenDownloads?: () => void;
  onStitchExport?: () => void;
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
  onOpenDownloads,
  onStitchExport,
}: ClipListViewProps) {
  const [activeTab, setActiveTab] = useState<"clips" | "skipped">("clips");
  const prevClipsRef = useRef<Clip[]>([]);

  const regularClips = sortedClips.filter((c) => c.status !== "rejected");
  const skippedClips = sortedClips.filter((c) => c.status === "rejected");
  const displayClips =
    activeTab === "clips"
      ? regularClips.filter((c) => !selectedTopic || c.topic === selectedTopic)
      : skippedClips.filter((c) => !selectedTopic || c.topic === selectedTopic);

  useEffect(() => {
    if (!clips) return;
    clips.forEach((clip) => {
      const prev = prevClipsRef.current.find((c) => c.id === clip.id);
      if (prev?.status !== "exported" && clip.status === "exported" && clip.export_url) {
        triggerDownload(clip.export_url, `${clip.clip_title ?? "clip"}.mp4`);
        toast.success("Clip ready!", {
          description: clip.clip_title ?? "Your clip has been exported",
          action: {
            label: "Download again",
            onClick: () => triggerDownload(clip.export_url!, `${clip.clip_title ?? "clip"}.mp4`),
          },
        });
        onOpenDownloads?.();
      }
    });
    prevClipsRef.current = clips;
  }, [clips, onOpenDownloads]);

  const hasTabs = clipsStatus !== "generating" && sortedClips.length > 0;

  return (
    <>
      <TopicFilterChips
        clips={clips}
        selectedTopic={selectedTopic}
        onSetSelectedTopic={onSetSelectedTopic}
      />
      {hasTabs && (
        <nav
          role="tablist"
          aria-label="Clip categories"
          className="flex border-b border-gray-800 -mx-4 px-4"
        >
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "clips"}
            onClick={() => setActiveTab("clips")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "clips" ? "border-violet-500 text-white" : "border-transparent text-gray-400 hover:text-white"}`}
          >
            Clips ({regularClips.length})
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "skipped"}
            onClick={() => setActiveTab("skipped")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "skipped" ? "border-violet-500 text-white" : "border-transparent text-gray-400 hover:text-white"}`}
          >
            Skipped ({skippedClips.length})
          </button>
        </nav>
      )}
      {hasTabs && activeTab === "clips" && regularClips.length > 0 && (
        <ExportBar
          sortedClips={regularClips}
          selectedClipIds={selectedClipIds}
          withCaptions={withCaptions}
          clips={clips}
          allApproved={regularClips.every((c) => c.status === "approved")}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onToggleCaptions={onToggleCaptions}
          onExportBatch={onExportBatch}
          onKeepAll={() => {
            regularClips.forEach((clip) => {
              if (clip.status !== "approved") onClipAction(clip.id, { status: "approved" });
            });
          }}
          onStitchExport={onStitchExport}
        />
      )}
      {hasTabs && (
        <div className="flex flex-col gap-3">
          {activeTab === "clips" &&
            displayClips.map((clip) => (
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
          {activeTab === "skipped" && (
            <ul className="flex flex-col gap-3">
              {displayClips.length === 0 && (
                <li>
                  <p className="text-sm text-gray-500 text-center py-8">No skipped clips</p>
                </li>
              )}
              {displayClips.map((clip) => (
                <li key={clip.id}>
                  <SkippedClipCard
                    clip={clip}
                    onRestore={(clipId) => onClipAction(clipId, { status: "pending" })}
                  />
                </li>
              ))}
            </ul>
          )}
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
