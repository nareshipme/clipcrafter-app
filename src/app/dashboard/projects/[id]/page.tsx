"use client";

import { use, useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useProjectData } from "@/components/project/useProjectData";
import { ProcessingStatus } from "@/components/project/ProcessingStatus";
import { PlayerSection } from "@/components/project/PlayerSection";
import { CompletedSidebar } from "@/components/project/CompletedSidebar";
import { Clip, Segment, TERMINAL_STATUSES } from "@/components/project/types";
import type { GraphNode, GraphSegment, GraphEdge, VideoGraph } from "@/lib/video-graph";

function statusBadgeClass(
  status:
    | "pending"
    | "processing"
    | "extracting_audio"
    | "transcribing"
    | "generating_highlights"
    | "completed"
    | "failed"
): string {
  if (status === "completed") return "bg-green-500";
  if (status === "failed") return "bg-red-500";
  if (["processing", "extracting_audio", "transcribing", "generating_highlights"].includes(status))
    return "bg-yellow-500";
  return "bg-gray-500";
}

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

type ProjectData = ReturnType<typeof useProjectData>;

function ProjectHeader({ data, onDelete }: { data: ProjectData["data"]; onDelete: () => void }) {
  return (
    <header className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-gray-800 shrink-0">
      <Link
        href="/dashboard"
        aria-label="Back"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm min-h-[44px] py-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back
      </Link>
      <span className="text-lg font-bold text-white flex-1">ClipCrafter</span>
      {data && (
        <span
          data-testid="status-badge"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusBadgeClass(data.status)}`}
        >
          {data.status}
        </span>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="text-gray-600 hover:text-red-400 transition-colors text-sm px-3 py-2 rounded-lg hover:bg-gray-900 min-h-[44px]"
        title="Delete project"
      >
        🗑 Delete
      </button>
    </header>
  );
}

/** Inline-editable project title */
function InlineTitle({
  projectId,
  title,
  onSave,
}: {
  projectId: string;
  title: string;
  onSave: (newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditValue(title);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        onSave(trimmed);
        setEditing(false);
      } else {
        toast.error("Failed to update project name");
        setEditing(false);
      }
    } catch {
      toast.error("Network error — could not save title");
      setEditing(false);
    }
  }

  const displayTitle = title.length > 30 ? title.slice(0, 30) + "…" : title;

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="text-xs text-white bg-gray-800 border border-violet-500 rounded px-2 py-0.5 w-48 focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex items-center gap-1 text-left min-w-0"
    >
      <span className="text-gray-300 hover:text-white truncate transition-colors">
        {displayTitle}
      </span>
      <svg
        className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z"
        />
      </svg>
    </button>
  );
}

function getCaptionText(p: ProjectData): string | null {
  if (!p.showCaptions || !p.data?.transcript?.segments) return null;
  const seg = (p.data.transcript.segments as Segment[]).find(
    (s) => p.currentTime >= s.start && p.currentTime <= s.end
  );
  return seg ? seg.text.replace(/^\[Speaker \d+\]\s*/, "") : null;
}

function useDerivedState(p: ProjectData) {
  const sortedClips = p.clips ? [...p.clips].sort((a, b) => b.score - a.score) : null;
  const selectedClip = p.clips?.find((c) => c.id === p.selectedClipId) ?? null;
  const computedGraph = useMemo(
    () => (p.clips && p.clips.length > 0 ? buildComputedGraph(p.clips, p.topicOverrides) : null),
    [p.clips, p.topicOverrides]
  );
  const captionText = getCaptionText(p);
  const isProcessing =
    p.data && !TERMINAL_STATUSES.includes(p.data.status) && p.data.status !== "pending";
  const isCompleted = p.data?.status === "completed";
  return { sortedClips, selectedClip, computedGraph, captionText, isProcessing, isCompleted };
}

function CompletedSidebarWrapper({
  p,
  sortedClips,
  computedGraph,
}: {
  p: ProjectData;
  sortedClips: Clip[] | null;
  computedGraph: ReturnType<typeof buildComputedGraph>;
}) {
  if (!p.data) return null;
  return (
    <CompletedSidebar
      clips={p.clips}
      sortedClips={sortedClips}
      computedGraph={computedGraph}
      viewMode={p.viewMode}
      clipsStatus={p.clipsStatus}
      selectedClipId={p.selectedClipId}
      selectedClipIds={p.selectedClipIds}
      selectedTopic={p.selectedTopic}
      withCaptions={p.withCaptions}
      topicOverrides={p.topicOverrides}
      clipCount={p.clipCount}
      clipPrompt={p.clipPrompt}
      clipTargetDuration={p.clipTargetDuration}
      data={p.data}
      artifacts={p.artifacts}
      transcriptOpen={p.transcriptOpen}
      downloadsOpen={p.downloadsOpen}
      howItRanOpen={p.howItRanOpen}
      videoRef={p.videoRef}
      onSwitchView={p.switchView}
      onGenerateClips={p.handleGenerateClips}
      onSetClipCount={p.setClipCount}
      onSetClipPrompt={p.setClipPrompt}
      onSetClipTargetDuration={p.setClipTargetDuration}
      onSetSelectedTopic={p.setSelectedTopic}
      onSetSelectedClipId={p.setSelectedClipId}
      onSeekToClip={p.seekToClip}
      onToggleClipCheck={(clipId, checked) => {
        p.setSelectedClipIds((prev) => {
          const next = new Set(prev);
          if (checked) next.add(clipId);
          else next.delete(clipId);
          return next;
        });
      }}
      onSelectAll={(ids) => p.setSelectedClipIds(new Set(ids))}
      onDeselectAll={() => p.setSelectedClipIds(new Set())}
      onToggleCaptions={() => p.setWithCaptions((v) => !v)}
      onExportBatch={p.handleExportBatch}
      onClipAction={p.handleClipAction}
      onExportClip={p.handleExportClip}
      onSetSelectedClipIds={p.setSelectedClipIds}
      onUpdateTopicLabel={p.updateTopicLabel}
      onSetTopicOverrides={p.setTopicOverrides}
      onToggleTranscript={() => p.setTranscriptOpen((o) => !o)}
      onToggleDownloads={() => p.setDownloadsOpen((o) => !o)}
      onToggleHowItRan={() => p.setHowItRanOpen((o) => !o)}
      onStitchExport={p.handleStitchExport}
    />
  );
}

function SidebarContent({
  p,
  sortedClips,
  computedGraph,
  isProcessing,
  isCompleted,
}: {
  p: ProjectData;
  sortedClips: Clip[] | null;
  computedGraph: ReturnType<typeof buildComputedGraph>;
  isProcessing: boolean | null | undefined;
  isCompleted: boolean | undefined;
}) {
  if (p.loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }
  if (!p.data) return <p className="text-gray-400">Project not found.</p>;
  return (
    <>
      {(isProcessing || p.data.status === "failed" || p.data.status === "pending") && (
        <ProcessingStatus
          status={p.data.status}
          errorMessage={p.data.error_message}
          onRetry={p.handleRetry}
        />
      )}
      {isCompleted && (
        <CompletedSidebarWrapper p={p} sortedClips={sortedClips} computedGraph={computedGraph} />
      )}
    </>
  );
}

// Exported for testing
export function ProjectDetailContent({ id }: { id: string }) {
  const p = useProjectData(id);
  const { sortedClips, selectedClip, computedGraph, captionText, isProcessing, isCompleted } =
    useDerivedState(p);

  // titleOverride: null = show API title, string = show user-edited title
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const title = titleOverride ?? p.data?.title ?? "";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <ProjectHeader data={p.data} onDelete={p.handleDelete} />
      {p.data && (
        <nav className="px-4 sm:px-6 py-2 border-b border-gray-800 text-xs text-gray-500 flex items-center gap-1 min-w-0">
          <Link href="/dashboard" className="hover:text-gray-300 transition-colors shrink-0">
            ← Dashboard
          </Link>
          <span className="mx-1 shrink-0">/</span>
          <InlineTitle projectId={id} title={title} onSave={setTitleOverride} />
        </nav>
      )}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <aside className="w-full lg:w-[420px] shrink-0 border-r border-gray-800 overflow-y-auto">
          <div className="px-4 sm:px-5 py-5 flex flex-col gap-5">
            <SidebarContent
              p={p}
              sortedClips={sortedClips}
              computedGraph={computedGraph}
              isProcessing={isProcessing}
              isCompleted={isCompleted}
            />
          </div>
        </aside>
        <main className="flex-1 flex flex-col min-w-0 lg:sticky lg:top-0 lg:h-screen">
          <PlayerSection
            isCompleted={!!isCompleted}
            artifacts={p.artifacts}
            videoUrl={p.videoUrl}
            isYouTube={p.isYouTube}
            youTubeVideoId={p.youTubeVideoId}
            videoRef={p.videoRef}
            timelineRef={p.timelineRef}
            sortedClips={sortedClips}
            selectedClipId={p.selectedClipId}
            clips={p.clips}
            duration={p.duration}
            currentTime={p.currentTime}
            isPlaying={p.isPlaying}
            isLooping={p.isLooping}
            isPreviewing={p.isPreviewing}
            showCaptions={p.showCaptions}
            captionText={captionText}
            selectedClip={selectedClip}
            onTimeUpdate={p.handleTimeUpdate}
            onLoadedMetadata={p.handleLoadedMetadata}
            onSetIsPlaying={p.setIsPlaying}
            onTimelineClick={p.handleTimelineClick}
            onHandleMouseDown={p.handleHandleMouseDown}
            onTogglePlay={p.togglePlay}
            onSkipPrev={p.skipPrev}
            onSkipNext={p.skipNext}
            onToggleLoop={() => p.setIsLooping((l) => !l)}
            onPlayAll={p.handlePlayAll}
            onStopPreviewing={p.stopPreviewing}
            onToggleCaptions={() => p.setShowCaptions((c) => !c)}
            onSetSelectedClipId={p.setSelectedClipId}
            onSeekToClip={p.seekToClip}
          />
        </main>
      </div>
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: Props) {
  const { id } = use(params);
  return <ProjectDetailContent id={id} />;
}
