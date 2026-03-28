"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Clip, Segment } from "./types";
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
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onSetSelectedTopic(null)}
        className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[32px] ${selectedTopic === null ? "bg-violet-600 border-violet-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
      >
        All topics ({clips?.length})
      </button>
      {topics.map((t) => {
        const count = clips?.filter((c) => c.topic === t).length ?? 0;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onSetSelectedTopic(selectedTopic === t ? null : t)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[32px] ${selectedTopic === t ? "bg-violet-600 border-violet-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
          >
            {t} ({count})
          </button>
        );
      })}
    </div>
  );
}

function OverflowMenu({
  withCaptions,
  onToggleCaptions,
}: {
  withCaptions: boolean;
  onToggleCaptions: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:text-white transition-colors min-h-[30px]"
      >
        •••
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-lg min-w-[160px] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              onToggleCaptions();
              setOpen(false);
            }}
            className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Caption: {withCaptions ? "ON" : "OFF"}
          </button>
        </div>
      )}
    </div>
  );
}

function ExportActions({
  selectedClipIds,
  isExporting,
  noneSelected,
  oneSelected,
  multiSelected,
  onExportBatch,
  onStitchExport,
}: {
  selectedClipIds: Set<string>;
  isExporting: boolean;
  noneSelected: boolean;
  oneSelected: boolean;
  multiSelected: boolean;
  onExportBatch: () => void;
  onStitchExport?: () => void;
}) {
  if (multiSelected && onStitchExport) {
    return (
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onExportBatch}
          disabled={isExporting}
          className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1 whitespace-nowrap"
        >
          ↗ individual
        </button>
        <button
          type="button"
          onClick={onStitchExport}
          disabled={isExporting}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors min-h-[36px]"
        >
          Stitch & Export ({selectedClipIds.size})
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onExportBatch}
      disabled={noneSelected || isExporting}
      className="ml-auto px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors min-h-[36px]"
    >
      {oneSelected ? "Export clip" : `Export ${selectedClipIds.size}`}
    </button>
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
  const isExporting =
    clips?.some((c) => selectedClipIds.has(c.id) && c.status === "exporting") ?? false;
  const noneSelected = selectedClipIds.size === 0;
  const multiSelected = selectedClipIds.size > 1;
  const oneSelected = selectedClipIds.size === 1;

  return (
    <div className="sticky top-0 z-10 bg-gray-950 py-2 flex items-center gap-2 border-b border-gray-800 -mx-4 px-4">
      <button
        type="button"
        onClick={() => {
          if (selectedClipIds.size === sortedClips.length) onDeselectAll();
          else onSelectAll(sortedClips.map((c) => c.id));
        }}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:text-white transition-colors min-h-[30px] whitespace-nowrap"
      >
        Select All
      </button>
      <button
        type="button"
        onClick={onKeepAll}
        disabled={allApproved}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[30px]"
      >
        Keep All
      </button>
      <OverflowMenu withCaptions={withCaptions} onToggleCaptions={onToggleCaptions} />
      <ExportActions
        selectedClipIds={selectedClipIds}
        isExporting={isExporting}
        noneSelected={noneSelected}
        oneSelected={oneSelected}
        multiSelected={multiSelected}
        onExportBatch={onExportBatch}
        onStitchExport={onStitchExport}
      />
    </div>
  );
}

function triggerDownload(clipId: string, filename: string) {
  // Use a proxy API route so mobile Safari downloads instead of opening inline
  // (the `download` attribute is ignored for cross-origin URLs on iOS)
  const a = document.createElement("a");
  a.href = `/api/clips/${clipId}/download`;
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
  transcriptSegments?: Segment[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onUpdateTopicLabel?: (original: string, newLabel: string) => void;
  topicOverrides?: Record<string, string>;
}

function ClipTabNav({
  activeTab,
  regularCount,
  skippedCount,
  onSwitch,
}: {
  activeTab: "clips" | "skipped";
  regularCount: number;
  skippedCount: number;
  onSwitch: (tab: "clips" | "skipped") => void;
}) {
  return (
    <nav
      role="tablist"
      aria-label="Clip categories"
      className="flex border-b border-gray-800 -mx-4 px-4"
    >
      <button
        role="tab"
        type="button"
        aria-selected={activeTab === "clips"}
        onClick={() => onSwitch("clips")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "clips" ? "border-violet-500 text-white" : "border-transparent text-gray-400 hover:text-white"}`}
      >
        Clips ({regularCount})
      </button>
      <button
        role="tab"
        type="button"
        aria-selected={activeTab === "skipped"}
        onClick={() => onSwitch("skipped")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "skipped" ? "border-violet-500 text-white" : "border-transparent text-gray-400 hover:text-white"}`}
      >
        Skipped ({skippedCount})
      </button>
    </nav>
  );
}

function SkippedList({ clips, onRestore }: { clips: Clip[]; onRestore: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {clips.length === 0 && (
        <li>
          <p className="text-sm text-gray-500 text-center py-8">No skipped clips</p>
        </li>
      )}
      {clips.map((clip) => (
        <li key={clip.id}>
          <SkippedClipCard clip={clip} onRestore={onRestore} />
        </li>
      ))}
    </ul>
  );
}

function useExportReadyToast(clips: Clip[] | null) {
  const prevClipsRef = useRef<Clip[]>([]);
  useEffect(() => {
    if (!clips) return;
    clips.forEach((clip) => {
      const prev = prevClipsRef.current.find((c) => c.id === clip.id);
      if (prev?.status !== "exported" && clip.status === "exported") {
        // Just notify — no auto-download
        toast.success("Clip ready!", {
          description: clip.clip_title ?? "Your clip has been exported",
          action: {
            label: "Download",
            onClick: () => triggerDownload(clip.id, `${clip.clip_title ?? "clip"}.mp4`),
          },
        });
      }
    });
    prevClipsRef.current = clips;
  }, [clips]);
}

type ClipBodyProps = {
  hasTabs: boolean;
  activeTab: "clips" | "skipped";
  setActiveTab: (t: "clips" | "skipped") => void;
  regularClips: Clip[];
  skippedClips: Clip[];
  displayClips: Clip[];
  transcriptSegments?: Segment[];
} & Omit<
  ClipListViewProps,
  "sortedClips" | "selectedTopic" | "onSetSelectedTopic" | "onOpenDownloads"
>;

function ClipBody(p: ClipBodyProps) {
  if (!p.hasTabs) return null;
  const keepAll = () =>
    p.regularClips.forEach((c) => {
      if (c.status !== "approved") p.onClipAction(c.id, { status: "approved" });
    });
  return (
    <>
      <ClipTabNav
        activeTab={p.activeTab}
        regularCount={p.regularClips.length}
        skippedCount={p.skippedClips.length}
        onSwitch={p.setActiveTab}
      />
      {p.activeTab === "clips" && p.regularClips.length > 0 && (
        <ExportBar
          sortedClips={p.regularClips}
          selectedClipIds={p.selectedClipIds}
          withCaptions={p.withCaptions}
          clips={p.clips}
          allApproved={p.regularClips.every((c) => c.status === "approved")}
          onSelectAll={p.onSelectAll}
          onDeselectAll={p.onDeselectAll}
          onToggleCaptions={p.onToggleCaptions}
          onExportBatch={p.onExportBatch}
          onKeepAll={keepAll}
          onStitchExport={p.onStitchExport}
        />
      )}
      <div className="flex flex-col gap-3">
        {p.activeTab === "clips" &&
          p.displayClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isSelected={clip.id === p.selectedClipId}
              isChecked={p.selectedClipIds.has(clip.id)}
              onSelect={p.onSetSelectedClipId}
              onSeekToClip={p.onSeekToClip}
              onToggleCheck={p.onToggleClipCheck}
              onClipAction={p.onClipAction}
              onExportClip={p.onExportClip}
              transcriptSegments={p.transcriptSegments}
              videoRef={p.videoRef}
              onUpdateTopicLabel={p.onUpdateTopicLabel}
              topicOverrides={p.topicOverrides}
            />
          ))}
        {p.activeTab === "skipped" && (
          <SkippedList
            clips={p.displayClips}
            onRestore={(id) => p.onClipAction(id, { status: "pending" })}
          />
        )}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={p.onGenerateClips}
            disabled={p.clipsStatus === "generating"}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
          >
            ↺ Regenerate Clips
          </button>
        </div>
      </div>
    </>
  );
}

export function ClipListView(props: ClipListViewProps) {
  const { sortedClips, selectedTopic, clipsStatus, clips, onSetSelectedTopic } = props;
  const [activeTab, setActiveTab] = useState<"clips" | "skipped">("clips");
  useExportReadyToast(clips);

  const regularClips = sortedClips.filter((c) => c.status !== "rejected");
  const skippedClips = sortedClips.filter((c) => c.status === "rejected");
  const filterByTopic = (arr: Clip[]) =>
    arr.filter((c) => !selectedTopic || c.topic === selectedTopic);
  const displayClips = filterByTopic(activeTab === "clips" ? regularClips : skippedClips);
  const hasTabs = clipsStatus !== "generating" && sortedClips.length > 0;

  return (
    <>
      <TopicFilterChips
        clips={clips}
        selectedTopic={selectedTopic}
        onSetSelectedTopic={onSetSelectedTopic}
      />
      <ClipBody
        {...props}
        hasTabs={hasTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        regularClips={regularClips}
        skippedClips={skippedClips}
        displayClips={displayClips}
        transcriptSegments={props.transcriptSegments}
      />
    </>
  );
}
