"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Clip } from "./types";
import type { GraphNode, VideoGraph } from "@/lib/video-graph";
import { ClipTimingEditor, ClipTopicEditor } from "./ClipEditControls";

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
  onExportBatch: () => void;
  onSwitchView: (mode: "list" | "graph") => void;
  onClipAction: (
    clipId: string,
    update: Partial<
      Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">
    >
  ) => void;
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
  onUpdateTopicLabel,
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
  onUpdateTopicLabel: GraphViewProps["onUpdateTopicLabel"];
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
        <div className="self-start ml-5">
          <ClipTopicEditor
            topic={node.label}
            originalTopic={node.summary}
            onUpdateTopicLabel={onUpdateTopicLabel}
          />
        </div>
      )}
      <ClipTimingEditor clip={clip} videoRef={videoRef} onClipAction={onClipAction} />
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
  onUpdateTopicLabel,
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
  | "onUpdateTopicLabel"
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
            onUpdateTopicLabel={onUpdateTopicLabel}
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
  videoRef,
  onSetSelectedClipId,
  onSeekToClip,
  onSetSelectedClipIds,
  onUpdateTopicLabel,
  onExportBatch,
  onSwitchView,
  onClipAction,
}: GraphViewProps) {
  return (
    <>
      {/* overflow-clip instead of overflow-hidden: clips visually without creating a new stacking
          context that would cause ReactFlow's SVG edge layer to be invisible (#55) */}
      <div className="rounded-xl border border-gray-800" style={{ height: 420, overflow: "clip" }}>
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
        onUpdateTopicLabel={onUpdateTopicLabel}
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
