"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useProjectData } from "./useProjectData";
import { Clip, TERMINAL_STATUSES } from "./types";
import type { GraphNode, GraphSegment, GraphEdge, VideoGraph } from "@/lib/video-graph";
import type { ProjectDataResult } from "./projectDataTypes";

function buildTopicEntry(
  topic: string,
  topicClips: Clip[],
  topicOverrides: Record<string, string>,
  nodeIndex: number
): { node: GraphNode; segments: GraphSegment[]; edges: GraphEdge[] } {
  const nodeId = `t${nodeIndex}`;
  const label = topicOverrides[topic] ?? topic;
  const avgScore = Math.round(topicClips.reduce((s, c) => s + c.score, 0) / topicClips.length);
  const node: GraphNode = {
    id: nodeId,
    label,
    summary: topic,
    importance: avgScore,
    speakerId: null,
  };
  const sorted = [...topicClips].sort((a, b) => a.start_sec - b.start_sec);
  const segs: GraphSegment[] = sorted.map((clip) => ({
    id: clip.id,
    topicId: nodeId,
    start: clip.start_sec,
    end: clip.end_sec,
    hookSentence: clip.clip_title ?? clip.title ?? "",
    intensityScore: clip.score,
  }));
  const edges: GraphEdge[] = segs.slice(0, -1).map((seg, i) => ({
    source: seg.id,
    target: segs[i + 1].id,
    relationshipType: "logical-flow" as const,
  }));
  return { node, segments: segs, edges };
}

function buildComputedGraph(
  clips: Clip[],
  topicOverrides: Record<string, string>
): VideoGraph | null {
  if (clips.length === 0) return null;
  const topicMap = new Map<string, Clip[]>();
  for (const clip of clips) {
    const t = clip.topic ?? "General";
    if (!topicMap.has(t)) topicMap.set(t, []);
    topicMap.get(t)!.push(clip);
  }
  const nodes: GraphNode[] = [];
  const segments: GraphSegment[] = [];
  const edges: GraphEdge[] = [];
  let ni = 0;
  for (const [topic, topicClips] of topicMap) {
    const entry = buildTopicEntry(topic, topicClips, topicOverrides, ni++);
    nodes.push(entry.node);
    segments.push(...entry.segments);
    edges.push(...entry.edges);
  }
  return { nodes, segments, edges };
}

export interface ProjectContextValue extends ProjectDataResult {
  projectId: string;
  sortedClips: Clip[] | null;
  computedGraph: VideoGraph | null;
  isProcessing: boolean;
  isCompleted: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectContextProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const p = useProjectData(id);

  const sortedClips = useMemo(
    () => (p.clips ? [...p.clips].sort((a, b) => b.score - a.score) : null),
    [p.clips]
  );

  const computedGraph = useMemo(
    () =>
      p.clips && p.clips.length > 0 ? buildComputedGraph(p.clips, p.topicOverrides) : null,
    [p.clips, p.topicOverrides]
  );

  const isProcessing = !!(
    p.data &&
    !TERMINAL_STATUSES.includes(p.data.status) &&
    p.data.status !== "pending"
  );
  const isCompleted = p.data?.status === "completed";

  const value: ProjectContextValue = {
    ...p,
    projectId: id,
    sortedClips,
    computedGraph,
    isProcessing,
    isCompleted: isCompleted ?? false,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectContextProvider");
  return ctx;
}
