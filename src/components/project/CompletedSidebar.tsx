"use client";

import React from "react";
import { Clip, StatusData, Artifact } from "./types";
import { ClipListView } from "./ClipListView";
import { GraphView } from "./GraphView";
import { CollapsibleSidebar } from "./CollapsibleSidebar";
import type { VideoGraph } from "@/lib/video-graph";

export interface CompletedSidebarProps {
  clips: Clip[] | null;
  sortedClips: Clip[] | null;
  computedGraph: VideoGraph | null;
  viewMode: "list" | "graph";
  clipsStatus: string;
  selectedClipId: string | null;
  selectedClipIds: Set<string>;
  selectedTopic: string | null;
  withCaptions: boolean;
  topicOverrides: Record<string, string>;
  clipCount: number | "auto";
  clipPrompt: string;
  clipTargetDuration: string;
  data: StatusData;
  artifacts: Record<string, Artifact> | null;
  transcriptOpen: boolean;
  downloadsOpen: boolean;
  howItRanOpen: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSwitchView: (mode: "list" | "graph") => void;
  onGenerateClips: () => void;
  onSetClipCount: (v: number | "auto") => void;
  onSetClipPrompt: (v: string) => void;
  onSetClipTargetDuration: (v: string) => void;
  onSetSelectedTopic: (t: string | null) => void;
  onSetSelectedClipId: (id: string) => void;
  onSeekToClip: (clip: Clip) => void;
  onToggleClipCheck: (clipId: string, checked: boolean) => void;
  onSelectAll: (ids: string[]) => void;
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
  onSetSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onUpdateTopicLabel: (original: string, label: string) => void;
  onSetTopicOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onToggleTranscript: () => void;
  onToggleDownloads: () => void;
  onToggleHowItRan: () => void;
  onStitchExport?: () => void;
}

function ViewToggle({
  viewMode,
  hasGraph,
  onSwitchView,
}: {
  viewMode: "list" | "graph";
  hasGraph: boolean;
  onSwitchView: (m: "list" | "graph") => void;
}) {
  if (!hasGraph) return null;
  return (
    <div className="flex items-center gap-1">
      {(["list", "graph"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onSwitchView(m)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] ${viewMode === m ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
        >
          {m === "list" ? "≡ List" : "⬡ Graph"}
        </button>
      ))}
    </div>
  );
}

function GenerateHeader({
  clips,
  clipsStatus,
  onGenerateClips,
}: {
  clips: Clip[] | null;
  clipsStatus: string;
  onGenerateClips: () => void;
}) {
  const isGenerating = clipsStatus === "generating";
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-lg font-bold text-white flex-1">✨ AI Clips</h2>
      {clips && clips.length > 0 && (
        <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full font-medium">
          {clips.length} clips
        </span>
      )}
      <button
        type="button"
        onClick={onGenerateClips}
        disabled={isGenerating}
        data-testid="generate-clips-btn"
        className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors min-h-[44px]"
      >
        {isGenerating ? "Generating…" : clips && clips.length > 0 ? "Regenerate" : "Generate Clips"}
      </button>
    </div>
  );
}

function GenerateControls({
  clipCount,
  clipPrompt,
  clipTargetDuration,
  clipsStatus,
  onSetClipCount,
  onSetClipPrompt,
  onSetClipTargetDuration,
}: {
  clipCount: number | "auto";
  clipPrompt: string;
  clipTargetDuration: string;
  clipsStatus: string;
  onSetClipCount: (v: number | "auto") => void;
  onSetClipPrompt: (v: string) => void;
  onSetClipTargetDuration: (v: string) => void;
}) {
  const isGenerating = clipsStatus === "generating";
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 shrink-0">Clips</label>
        <select
          value={clipCount}
          onChange={(e) =>
            onSetClipCount(e.target.value === "auto" ? "auto" : Number(e.target.value))
          }
          disabled={isGenerating}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[36px]"
        >
          <option value="auto">Auto</option>
          {[3, 5, 7, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 shrink-0">Duration (s)</label>
        <input
          type="number"
          placeholder="any"
          value={clipTargetDuration}
          onChange={(e) => onSetClipTargetDuration(e.target.value)}
          disabled={isGenerating}
          className="w-16 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[36px]"
        />
      </div>
      <input
        type="text"
        placeholder="Search topic (optional)…"
        value={clipPrompt}
        onChange={(e) => onSetClipPrompt(e.target.value)}
        disabled={isGenerating}
        className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 text-gray-300 placeholder-gray-600 text-xs rounded-lg px-3 py-1.5 min-h-[36px]"
      />
    </div>
  );
}

function ClipSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-10 bg-gray-800 rounded-full" />
            <div className="h-4 w-40 bg-gray-800 rounded" />
          </div>
          <div className="h-3 w-32 bg-gray-800 rounded mb-3" />
          <div className="flex gap-2">
            <div className="h-3 w-16 bg-gray-800 rounded-full" />
            <div className="h-3 w-20 bg-gray-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoClipsState({ onGenerateClips }: { onGenerateClips: () => void }) {
  return (
    <div className="text-center py-14 bg-gray-900 border border-gray-800 rounded-xl flex flex-col items-center gap-4">
      <p className="text-gray-400 text-sm">No clips yet — generate AI clips from your highlights</p>
      <button
        type="button"
        onClick={onGenerateClips}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-base font-semibold text-white transition-colors min-h-[44px]"
      >
        ✨ Generate AI Clips
      </button>
    </div>
  );
}

type ClipViewProps = Pick<
  CompletedSidebarProps,
  | "clips"
  | "sortedClips"
  | "computedGraph"
  | "viewMode"
  | "clipsStatus"
  | "selectedClipId"
  | "selectedClipIds"
  | "selectedTopic"
  | "withCaptions"
  | "topicOverrides"
  | "videoRef"
  | "onSwitchView"
  | "onGenerateClips"
  | "onSetSelectedTopic"
  | "onSetSelectedClipId"
  | "onSeekToClip"
  | "onToggleClipCheck"
  | "onSelectAll"
  | "onDeselectAll"
  | "onToggleCaptions"
  | "onExportBatch"
  | "onClipAction"
  | "onExportClip"
  | "onSetSelectedClipIds"
  | "onUpdateTopicLabel"
  | "onSetTopicOverrides"
  | "onStitchExport"
> & {
  onOpenDownloads?: () => void;
};

function ClipView(props: ClipViewProps) {
  const {
    clips,
    sortedClips,
    computedGraph,
    viewMode,
    clipsStatus,
    selectedClipId,
    selectedClipIds,
    selectedTopic,
    withCaptions,
    topicOverrides,
    videoRef,
    onSwitchView,
    onGenerateClips,
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
    onSetSelectedClipIds,
    onUpdateTopicLabel,
    onSetTopicOverrides,
    onOpenDownloads,
    onStitchExport,
  } = props;
  if (clipsStatus === "generating") return <ClipSkeleton />;
  if (clips === null || clips.length === 0)
    return <NoClipsState onGenerateClips={onGenerateClips} />;
  if (viewMode === "graph" && computedGraph) {
    return (
      <GraphView
        computedGraph={computedGraph}
        clips={clips}
        sortedClips={sortedClips ?? []}
        selectedClipIds={selectedClipIds}
        selectedClipId={selectedClipId}
        topicOverrides={topicOverrides}
        videoRef={videoRef}
        onSetSelectedClipId={onSetSelectedClipId}
        onSeekToClip={onSeekToClip}
        onSetSelectedClipIds={onSetSelectedClipIds}
        onUpdateTopicLabel={onUpdateTopicLabel}
        onSetTopicOverrides={onSetTopicOverrides}
        onExportBatch={onExportBatch}
        onSwitchView={onSwitchView}
        onClipAction={onClipAction}
      />
    );
  }
  if (viewMode === "list" && sortedClips && sortedClips.length > 0) {
    return (
      <ClipListView
        sortedClips={sortedClips}
        selectedClipId={selectedClipId}
        selectedClipIds={selectedClipIds}
        selectedTopic={selectedTopic}
        clipsStatus={clipsStatus}
        clips={clips}
        withCaptions={withCaptions}
        onSetSelectedTopic={onSetSelectedTopic}
        onSetSelectedClipId={onSetSelectedClipId}
        onSeekToClip={onSeekToClip}
        onToggleClipCheck={onToggleClipCheck}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        onToggleCaptions={onToggleCaptions}
        onExportBatch={onExportBatch}
        onClipAction={onClipAction}
        onExportClip={onExportClip}
        onGenerateClips={onGenerateClips}
        onOpenDownloads={onOpenDownloads}
        onStitchExport={onStitchExport}
      />
    );
  }
  return null;
}

function GenerateSection(p: CompletedSidebarProps) {
  return (
    <>
      <GenerateHeader
        clips={p.clips}
        clipsStatus={p.clipsStatus}
        onGenerateClips={p.onGenerateClips}
      />
      <GenerateControls
        clipCount={p.clipCount}
        clipPrompt={p.clipPrompt}
        clipTargetDuration={p.clipTargetDuration}
        clipsStatus={p.clipsStatus}
        onSetClipCount={p.onSetClipCount}
        onSetClipPrompt={p.onSetClipPrompt}
        onSetClipTargetDuration={p.onSetClipTargetDuration}
      />
      <ClipView
        clips={p.clips}
        sortedClips={p.sortedClips}
        computedGraph={p.computedGraph}
        viewMode={p.viewMode}
        clipsStatus={p.clipsStatus}
        selectedClipId={p.selectedClipId}
        selectedClipIds={p.selectedClipIds}
        selectedTopic={p.selectedTopic}
        withCaptions={p.withCaptions}
        topicOverrides={p.topicOverrides}
        videoRef={p.videoRef}
        onSwitchView={p.onSwitchView}
        onGenerateClips={p.onGenerateClips}
        onSetSelectedTopic={p.onSetSelectedTopic}
        onSetSelectedClipId={p.onSetSelectedClipId}
        onSeekToClip={p.onSeekToClip}
        onToggleClipCheck={p.onToggleClipCheck}
        onSelectAll={p.onSelectAll}
        onDeselectAll={p.onDeselectAll}
        onToggleCaptions={p.onToggleCaptions}
        onExportBatch={p.onExportBatch}
        onClipAction={p.onClipAction}
        onExportClip={p.onExportClip}
        onSetSelectedClipIds={p.onSetSelectedClipIds}
        onUpdateTopicLabel={p.onUpdateTopicLabel}
        onSetTopicOverrides={p.onSetTopicOverrides}
        onOpenDownloads={p.downloadsOpen ? undefined : p.onToggleDownloads}
        onStitchExport={p.onStitchExport}
      />
    </>
  );
}

export function CompletedSidebar(p: CompletedSidebarProps) {
  return (
    <>
      <ViewToggle
        viewMode={p.viewMode}
        hasGraph={!!p.computedGraph}
        onSwitchView={p.onSwitchView}
      />
      <GenerateSection {...p} />
      <CollapsibleSidebar
        data={p.data}
        artifacts={p.artifacts}
        clips={p.clips ?? []}
        projectTitle={p.data.title}
        transcriptOpen={p.transcriptOpen}
        downloadsOpen={p.downloadsOpen}
        howItRanOpen={p.howItRanOpen}
        onToggleTranscript={p.onToggleTranscript}
        onToggleDownloads={p.onToggleDownloads}
        onToggleHowItRan={p.onToggleHowItRan}
      />
    </>
  );
}
