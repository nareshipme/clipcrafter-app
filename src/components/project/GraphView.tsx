"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Clip } from "./types";
import type { GraphNode, VideoGraph } from "@/lib/video-graph";

const VideoKnowledgeGraph = dynamic(() => import("@/components/VideoKnowledgeGraph"), {
  ssr: false,
});

type ComputedGraph = VideoGraph;

export interface GraphViewProps {
  computedGraph: ComputedGraph;
  clips: Clip[] | null;
  sortedClips: Clip[];
  selectedClipIds: Set<string>;
  selectedClipId: string | null;
  topicOverrides: Record<string, string>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSetSelectedClipId: (id: string) => void;
  onSeekToClip: (clip: Clip) => void;
  onSetSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onUpdateTopicLabel: (originalTopic: string, label: string) => void;
  onSetTopicOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onExportBatch: () => void;
  onSwitchView: (mode: "list" | "graph") => void;
  onClipAction: (
    clipId: string,
    update: Partial<
      Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">
    >
  ) => void;
}

function ClipTimingInputs({
  clip,
  videoRef,
  onClipAction,
}: {
  clip: Clip;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClipAction: GraphViewProps["onClipAction"];
}) {
  return (
    <div className="flex items-center gap-2 ml-5">
      <label className="text-xs text-gray-500 w-8 shrink-0">Start</label>
      <input
        type="number"
        step="0.1"
        min="0"
        defaultValue={clip.start_sec.toFixed(1)}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v !== clip.start_sec) onClipAction(clip.id, { start_sec: v });
        }}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && videoRef.current) videoRef.current.currentTime = v;
        }}
        className="w-20 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 font-mono focus:border-violet-500 outline-none"
      />
      <label className="text-xs text-gray-500 w-5 shrink-0">End</label>
      <input
        type="number"
        step="0.1"
        min="0"
        defaultValue={clip.end_sec.toFixed(1)}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v !== clip.end_sec) onClipAction(clip.id, { end_sec: v });
        }}
        className="w-20 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 font-mono focus:border-violet-500 outline-none"
      />
      <span className="text-xs text-gray-500 font-mono">
        {(clip.end_sec - clip.start_sec).toFixed(1)}s
      </span>
    </div>
  );
}

function GraphClipRow({
  clip,
  isSelected,
  isChecked,
  node,
  videoRef,
  onSelect,
  onSeekToClip,
  onToggleCheck,
  onClipAction,
}: {
  clip: Clip;
  isSelected: boolean;
  isChecked: boolean;
  node: GraphNode | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSelect: (id: string) => void;
  onSeekToClip: (clip: Clip) => void;
  onToggleCheck: (id: string, checked: boolean) => void;
  onClipAction: GraphViewProps["onClipAction"];
}) {
  const scoreClass =
    clip.score === 0
      ? "bg-gray-700 text-gray-400"
      : clip.score >= 70
        ? "bg-green-500 text-white"
        : clip.score >= 40
          ? "bg-yellow-500 text-black"
          : "bg-red-500 text-white";
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg p-3 border transition-all ${isChecked ? "bg-violet-950/40 border-violet-700" : isSelected ? "bg-gray-800 border-gray-600" : "bg-gray-800 border-gray-700"}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onToggleCheck(clip.id, e.target.checked)}
          className="mt-0.5 w-3.5 h-3.5 accent-violet-500 cursor-pointer shrink-0"
        />
        <p
          className="text-xs text-gray-200 leading-snug flex-1 cursor-pointer"
          onClick={() => {
            onSelect(clip.id);
            onSeekToClip(clip);
          }}
          title="Click to preview"
        >
          {clip.clip_title ?? clip.title ?? "Untitled"}
        </p>
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${scoreClass}`}>
          {clip.score === 0 ? "—" : clip.score}
        </span>
      </div>
      {node && (
        <span className="text-xs text-violet-400 bg-violet-900/40 px-2 py-0.5 rounded-full self-start ml-5">
          {node.label}
        </span>
      )}
      <ClipTimingInputs clip={clip} videoRef={videoRef} onClipAction={onClipAction} />
    </div>
  );
}

function TopicLabels({
  computedGraph,
  topicOverrides,
  onUpdateTopicLabel,
  onSetTopicOverrides,
}: Pick<
  GraphViewProps,
  "computedGraph" | "topicOverrides" | "onUpdateTopicLabel" | "onSetTopicOverrides"
>) {
  return (
    <div className="flex flex-col gap-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Topics</h3>
        {Object.keys(topicOverrides).length > 0 && (
          <button
            type="button"
            onClick={() => onSetTopicOverrides({})}
            className="text-xs text-gray-600 hover:text-yellow-400 transition-colors"
          >
            ↺ reset labels
          </button>
        )}
      </div>
      {computedGraph.nodes.map((node) => (
        <div key={node.id} className="flex items-center gap-2">
          <span
            className="shrink-0 w-2 h-2 rounded-full"
            style={{
              background:
                node.importance >= 70 ? "#7c3aed" : node.importance >= 40 ? "#2563eb" : "#4b5563",
            }}
          />
          <input
            type="text"
            value={node.label}
            onChange={(e) => onUpdateTopicLabel(node.summary, e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 focus:border-violet-500 outline-none"
          />
          <span className="text-xs text-gray-600 w-6 text-right font-mono">
            {computedGraph.segments.filter((s) => s.topicId === node.id).length}
          </span>
        </div>
      ))}
    </div>
  );
}

function GraphClipList({
  computedGraph,
  sortedClips,
  selectedClipIds,
  selectedClipId,
  videoRef,
  onSetSelectedClipId,
  onSeekToClip,
  onSetSelectedClipIds,
  onClipAction,
}: Pick<
  GraphViewProps,
  | "computedGraph"
  | "sortedClips"
  | "selectedClipIds"
  | "selectedClipId"
  | "videoRef"
  | "onSetSelectedClipId"
  | "onSeekToClip"
  | "onSetSelectedClipIds"
  | "onClipAction"
>) {
  return (
    <div className="flex flex-col gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Clips
          {selectedClipIds.size > 0 && (
            <span className="ml-2 text-violet-400 normal-case font-normal">
              ({selectedClipIds.size} selected)
            </span>
          )}
        </h3>
        {selectedClipIds.size > 0 && (
          <button
            type="button"
            onClick={() => onSetSelectedClipIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Deselect all
          </button>
        )}
      </div>
      {sortedClips.map((clip) => {
        const node = computedGraph.nodes.find(
          (n) => computedGraph.segments.find((s) => s.id === clip.id)?.topicId === n.id
        );
        return (
          <GraphClipRow
            key={clip.id}
            clip={clip}
            isSelected={clip.id === selectedClipId}
            isChecked={selectedClipIds.has(clip.id)}
            node={node}
            videoRef={videoRef}
            onSelect={onSetSelectedClipId}
            onSeekToClip={onSeekToClip}
            onToggleCheck={(id, checked) =>
              onSetSelectedClipIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              })
            }
            onClipAction={onClipAction}
          />
        );
      })}
    </div>
  );
}

export function GraphView({
  computedGraph,
  clips,
  sortedClips,
  selectedClipIds,
  selectedClipId,
  topicOverrides,
  videoRef,
  onSetSelectedClipId,
  onSeekToClip,
  onSetSelectedClipIds,
  onUpdateTopicLabel,
  onSetTopicOverrides,
  onExportBatch,
  onSwitchView,
  onClipAction,
}: GraphViewProps) {
  return (
    <>
      <div className="rounded-xl overflow-hidden border border-gray-800" style={{ height: 420 }}>
        <VideoKnowledgeGraph
          graph={computedGraph}
          onSegmentClick={(segment) => {
            const clip = clips?.find((c) => c.id === segment.id);
            if (clip) {
              onSetSelectedClipId(clip.id);
              onSeekToClip(clip);
            }
          }}
          selectedSegmentIds={selectedClipIds}
          onSegmentSelect={(segId, selected) =>
            onSetSelectedClipIds((prev) => {
              const next = new Set(prev);
              if (selected) next.add(segId);
              else next.delete(segId);
              return next;
            })
          }
          onSelectAll={(ids) => onSetSelectedClipIds(new Set(ids))}
          onKeepAll={() => {
            sortedClips.forEach((clip) => {
              if (clip.status !== "approved") onClipAction(clip.id, { status: "approved" });
            });
          }}
        />
      </div>
      <TopicLabels
        computedGraph={computedGraph}
        topicOverrides={topicOverrides}
        onUpdateTopicLabel={onUpdateTopicLabel}
        onSetTopicOverrides={onSetTopicOverrides}
      />
      <GraphClipList
        computedGraph={computedGraph}
        sortedClips={sortedClips}
        selectedClipIds={selectedClipIds}
        selectedClipId={selectedClipId}
        videoRef={videoRef}
        onSetSelectedClipId={onSetSelectedClipId}
        onSeekToClip={onSeekToClip}
        onSetSelectedClipIds={onSetSelectedClipIds}
        onClipAction={onClipAction}
      />
      {selectedClipIds.size > 0 && (
        <button
          type="button"
          onClick={() => {
            onExportBatch();
            onSwitchView("list");
          }}
          className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold text-white transition-colors min-h-[44px]"
        >
          Export {selectedClipIds.size} clip{selectedClipIds.size !== 1 ? "s" : ""} →
        </button>
      )}
    </>
  );
}
