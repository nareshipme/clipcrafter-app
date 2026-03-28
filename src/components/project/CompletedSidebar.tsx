"use client";

import React, { useState, useRef, useEffect } from "react";
import { Clip, Segment, StatusData } from "./types";
import { ClipListView } from "./ClipListView";
import { GraphView } from "./GraphView";
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
          {m === "list" ? "✦ Highlights" : "⬡ Knowledge Graph"}
        </button>
      ))}
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

function NoClipsState({
  onGenerateClips,
  errorMessage,
}: {
  onGenerateClips: () => void;
  errorMessage?: string;
}) {
  return (
    <div className="text-center py-14 bg-gray-900 border border-gray-800 rounded-xl flex flex-col items-center gap-4">
      {errorMessage ? (
        <p className="text-red-400 text-sm">{errorMessage}</p>
      ) : (
        <p className="text-gray-400 text-sm">
          No clips yet — generate AI clips from your highlights
        </p>
      )}
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
> & { transcriptSegments?: Segment[] };

function ClipViewBody(props: ClipViewProps & { clips: NonNullable<ClipViewProps["clips"]> }) {
  const { viewMode, computedGraph, sortedClips, clips } = props;
  if (viewMode === "graph" && computedGraph) {
    return (
      <GraphView
        computedGraph={computedGraph}
        clips={clips}
        sortedClips={sortedClips ?? []}
        selectedClipIds={props.selectedClipIds}
        selectedClipId={props.selectedClipId}
        topicOverrides={props.topicOverrides}
        videoRef={props.videoRef}
        onSetSelectedClipId={props.onSetSelectedClipId}
        onSeekToClip={props.onSeekToClip}
        onSetSelectedClipIds={props.onSetSelectedClipIds}
        onUpdateTopicLabel={props.onUpdateTopicLabel}
        onExportBatch={props.onExportBatch}
        onSwitchView={props.onSwitchView}
        onClipAction={props.onClipAction}
      />
    );
  }
  if (viewMode === "list" && sortedClips && sortedClips.length > 0) {
    return (
      <ClipListView
        sortedClips={sortedClips}
        selectedClipId={props.selectedClipId}
        selectedClipIds={props.selectedClipIds}
        selectedTopic={props.selectedTopic}
        clipsStatus={props.clipsStatus}
        clips={clips}
        withCaptions={props.withCaptions}
        onSetSelectedTopic={props.onSetSelectedTopic}
        onSetSelectedClipId={props.onSetSelectedClipId}
        onSeekToClip={props.onSeekToClip}
        onToggleClipCheck={props.onToggleClipCheck}
        onSelectAll={props.onSelectAll}
        onDeselectAll={props.onDeselectAll}
        onToggleCaptions={props.onToggleCaptions}
        onExportBatch={props.onExportBatch}
        onClipAction={props.onClipAction}
        onExportClip={props.onExportClip}
        onGenerateClips={props.onGenerateClips}
        onStitchExport={props.onStitchExport}
        transcriptSegments={props.transcriptSegments}
        videoRef={props.videoRef}
        onUpdateTopicLabel={props.onUpdateTopicLabel}
        topicOverrides={props.topicOverrides}
      />
    );
  }
  return null;
}

function ClipView(props: ClipViewProps) {
  const { clips, clipsStatus, onGenerateClips } = props;
  if (clipsStatus === "generating") return <ClipSkeleton />;
  if (clipsStatus === "error")
    return (
      <NoClipsState
        onGenerateClips={onGenerateClips}
        errorMessage="Clip generation timed out. Please try again."
      />
    );
  if (clips === null || clips.length === 0)
    return <NoClipsState onGenerateClips={onGenerateClips} />;
  return <ClipViewBody {...props} clips={clips} />;
}

type SettingsSnapshot = {
  clipCount: number | "auto";
  clipPrompt: string;
  clipTargetDuration: string;
};

function useSmartRegenerate(
  hasClips: boolean,
  settings: SettingsSnapshot,
  onGenerateClips: () => void
) {
  const lastGenerated = useRef<SettingsSnapshot | null>(null);

  useEffect(() => {
    if (hasClips && lastGenerated.current === null) {
      lastGenerated.current = settings;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasClips]);

  const snap = lastGenerated.current;
  const settingsChanged =
    snap === null ||
    settings.clipCount !== snap.clipCount ||
    settings.clipPrompt !== snap.clipPrompt ||
    settings.clipTargetDuration !== snap.clipTargetDuration;

  function handleGenerate() {
    lastGenerated.current = settings;
    onGenerateClips();
  }

  return { settingsChanged, handleGenerate };
}

function ClipSectionHeader({
  viewMode,
  hasGraph,
  hasClips,
  settingsOpen,
  regenerateDisabled,
  isGenerating,
  onSwitchView,
  onToggleSettings,
  onRegenerate,
}: {
  viewMode: "list" | "graph";
  hasGraph: boolean;
  hasClips: boolean;
  settingsOpen: boolean;
  regenerateDisabled: boolean;
  isGenerating: boolean;
  onSwitchView: (m: "list" | "graph") => void;
  onToggleSettings: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <ViewToggle viewMode={viewMode} hasGraph={hasGraph} onSwitchView={onSwitchView} />
      <div className="flex-1" />
      {hasClips && (
        <>
          <button
            type="button"
            onClick={onToggleSettings}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-700 bg-transparent text-gray-400 hover:text-white transition-colors min-h-[32px]"
          >
            ⚙ {settingsOpen ? "▴" : "▾"}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            data-testid="generate-clips-btn"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors min-h-[36px]"
          >
            {isGenerating ? "Generating…" : "Regenerate"}
          </button>
        </>
      )}
    </div>
  );
}

function GenerateSection(p: CompletedSidebarProps) {
  const hasClips = !!(p.clips && p.clips.length > 0);
  const [settingsOpen, setSettingsOpen] = useState(!hasClips);
  const isGenerating = p.clipsStatus === "generating";

  const settings: SettingsSnapshot = {
    clipCount: p.clipCount,
    clipPrompt: p.clipPrompt,
    clipTargetDuration: p.clipTargetDuration,
  };
  const { settingsChanged, handleGenerate } = useSmartRegenerate(
    hasClips,
    settings,
    p.onGenerateClips
  );

  const regenerateDisabled = isGenerating || (hasClips && !settingsChanged);

  return (
    <>
      <ClipSectionHeader
        viewMode={p.viewMode}
        hasGraph={!!p.computedGraph}
        hasClips={hasClips}
        settingsOpen={settingsOpen}
        regenerateDisabled={regenerateDisabled}
        isGenerating={isGenerating}
        onSwitchView={p.onSwitchView}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        onRegenerate={handleGenerate}
      />
      {(!hasClips || settingsOpen) && (
        <GenerateControls
          clipCount={p.clipCount}
          clipPrompt={p.clipPrompt}
          clipTargetDuration={p.clipTargetDuration}
          clipsStatus={p.clipsStatus}
          onSetClipCount={p.onSetClipCount}
          onSetClipPrompt={p.onSetClipPrompt}
          onSetClipTargetDuration={p.onSetClipTargetDuration}
        />
      )}
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
        onGenerateClips={handleGenerate}
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
        onStitchExport={p.onStitchExport}
        transcriptSegments={(p.data.transcript?.segments ?? []) as Segment[]}
      />
    </>
  );
}

export function CompletedSidebar(p: CompletedSidebarProps) {
  return <GenerateSection {...p} />;
}
