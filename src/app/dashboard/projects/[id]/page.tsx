"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface Artifact {
  url: string;
  label: string;
  available: boolean;
}

type ProjectStatus =
  | "pending"
  | "processing"
  | "extracting_audio"
  | "transcribing"
  | "generating_highlights"
  | "completed"
  | "failed";

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface ProcessingLogEntry {
  step: string;
  provider?: string;
  detail?: string;
  status: "ok" | "error" | "fallback";
  ts: string;
}

interface StatusData {
  id: string;
  status: ProjectStatus;
  error_message: string | null;
  completed_at: string | null;
  processing_log: ProcessingLogEntry[];
  transcript: { id: string; segments: Segment[] } | null;
  highlights: { id: string; segments: unknown[] } | null;
}

interface Clip {
  id: string;
  project_id: string;
  title: string | null;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  score: number;
  score_reason: string | null;
  status: "pending" | "approved" | "rejected" | "exporting" | "exported";
  caption_style: string;
  aspect_ratio: string;
  export_url: string | null;
  hashtags: string[];
  clip_title: string | null;
}

type CaptionStyle = "hormozi" | "modern" | "neon" | "minimal";

const TERMINAL_STATUSES: ProjectStatus[] = ["completed", "failed"];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STAGES = [
  { label: "Downloading video" },
  { label: "Extracting audio" },
  { label: "Transcribing" },
  { label: "Generating highlights" },
  { label: "Finalizing" },
] as const;

function getActiveStep(status: ProjectStatus): number {
  if (status === "processing") return 0;
  if (status === "extracting_audio") return 1;
  if (status === "transcribing") return 2;
  if (status === "generating_highlights") return 3;
  if (status === "completed") return 4;
  return -1;
}

function statusBadgeClass(status: ProjectStatus): string {
  if (status === "completed") return "bg-green-500";
  if (status === "failed") return "bg-red-500";
  if (["processing", "extracting_audio", "transcribing", "generating_highlights"].includes(status))
    return "bg-yellow-500";
  return "bg-gray-500";
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

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition-colors min-h-[44px]"
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Exported for testing
export function ProjectDetailContent({ id }: { id: string }) {
  // Project/data state
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact> | null>(null);

  // Clips state
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Sidebar open/close
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [howItRanOpen, setHowItRanOpen] = useState(false);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewClipIndexRef = useRef(0);
  const previewClipsRef = useRef<Clip[]>([]);

  // Timeline drag state
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    clipId: string;
    side: "start" | "end";
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/status`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.status === "completed" && !artifacts) {
          fetch(`/api/projects/${id}/artifacts`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setArtifacts(d.artifacts);
                if (d.artifacts?.video?.available && d.artifacts.video.url) {
                  setVideoUrl(d.artifacts.video.url);
                }
              }
            })
            .catch(() => undefined);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, artifacts]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!data || TERMINAL_STATUSES.includes(data.status)) return;
    const interval = setInterval(() => { fetchStatus(); }, 3000);
    return () => clearInterval(interval);
  }, [data, fetchStatus]);

  // Auto-load clips when completed
  useEffect(() => {
    if (data?.status !== "completed" || clips !== null || clipsLoading) return;
    setClipsLoading(true);
    fetch(`/api/projects/${id}/clips`)
      .then(r => r.ok ? r.json() : null)
      .then(async d => {
        if (d && d.clips && d.clips.length > 0) {
          const sorted = [...d.clips].sort((a: Clip, b: Clip) => b.score - a.score);
          setClips(sorted);
          setSelectedClipId(sorted[0].id);
          if (videoRef.current) {
            videoRef.current.currentTime = sorted[0].start_sec;
          }
        } else {
          // Auto-generate on first visit
          const genRes = await fetch(`/api/projects/${id}/clips`, { method: "POST" });
          if (genRes.ok) {
            const genData = await genRes.json();
            const sorted = [...(genData.clips ?? [])].sort((a: Clip, b: Clip) => b.score - a.score);
            setClips(sorted);
            if (sorted.length > 0) {
              setSelectedClipId(sorted[0].id);
              if (videoRef.current) {
                videoRef.current.currentTime = sorted[0].start_sec;
              }
            }
          } else {
            setClips([]);
          }
        }
      })
      .catch(() => setClips([]))
      .finally(() => setClipsLoading(false));
  }, [data?.status, clips, id, clipsLoading]);

  async function handleRetry() {
    await fetch(`/api/projects/${id}/process`, { method: "POST" });
    setLoading(true);
    fetchStatus();
  }

  async function handleDelete() {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/dashboard";
    }
  }

  async function handleGenerateClips() {
    setClipsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/clips`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        const sorted = [...(json.clips ?? [])].sort((a: Clip, b: Clip) => b.score - a.score);
        setClips(sorted);
        if (sorted.length > 0) {
          setSelectedClipId(sorted[0].id);
          if (videoRef.current) {
            videoRef.current.currentTime = sorted[0].start_sec;
          }
        }
      }
    } finally {
      setClipsLoading(false);
    }
  }

  async function handleClipAction(
    clipId: string,
    update: Partial<Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">>
  ) {
    const res = await fetch(`/api/clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (res.ok) {
      const json = await res.json();
      setClips(prev => prev?.map(c => c.id === clipId ? { ...c, ...json.clip } : c) ?? null);
    }
  }

  async function handleExportClip(clipId: string) {
    const res = await fetch(`/api/clips/${clipId}/export`, { method: "POST" });
    if (res.ok) {
      setClips(prev => prev?.map(c => c.id === clipId ? { ...c, status: "exporting" } : c) ?? null);
    }
  }

  // Video controls
  function togglePlay() {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }

  function seekToClip(clip: Clip) {
    if (videoRef.current) {
      videoRef.current.currentTime = clip.start_sec;
      videoRef.current.play();
    }
  }

  function skipPrev() {
    if (!clips || !selectedClipId) return;
    const sorted = [...clips].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex(c => c.id === selectedClipId);
    if (idx > 0) {
      const prev = sorted[idx - 1];
      setSelectedClipId(prev.id);
      seekToClip(prev);
    }
  }

  function skipNext() {
    if (!clips || !selectedClipId) return;
    const sorted = [...clips].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex(c => c.id === selectedClipId);
    if (idx < sorted.length - 1) {
      const next = sorted[idx + 1];
      setSelectedClipId(next.id);
      seekToClip(next);
    }
  }

  function handlePlayAll() {
    if (!clips || clips.length === 0 || !videoRef.current) return;
    // approved first, then rest by score
    const sorted = [
      ...clips.filter(c => c.status === "approved").sort((a, b) => b.score - a.score),
      ...clips.filter(c => c.status !== "approved").sort((a, b) => b.score - a.score),
    ];
    previewClipsRef.current = sorted;
    previewClipIndexRef.current = 0;
    setIsPreviewing(true);
    setSelectedClipId(sorted[0].id);
    videoRef.current.currentTime = sorted[0].start_sec;
    videoRef.current.play();
  }

  function stopPreviewing() {
    setIsPreviewing(false);
    if (videoRef.current) videoRef.current.pause();
  }

  // Video event handlers
  function handleTimeUpdate() {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (isLooping && selectedClipId && clips) {
      const clip = clips.find(c => c.id === selectedClipId);
      if (clip && t >= clip.end_sec) {
        videoRef.current.currentTime = clip.start_sec;
        return;
      }
    }

    if (isPreviewing) {
      const previewClips = previewClipsRef.current;
      const idx = previewClipIndexRef.current;
      if (idx < previewClips.length) {
        const clip = previewClips[idx];
        if (t >= clip.end_sec) {
          const nextIdx = idx + 1;
          if (nextIdx < previewClips.length) {
            previewClipIndexRef.current = nextIdx;
            setSelectedClipId(previewClips[nextIdx].id);
            videoRef.current.currentTime = previewClips[nextIdx].start_sec;
          } else {
            setIsPreviewing(false);
            videoRef.current.pause();
          }
        }
      }
    }
  }

  function handleLoadedMetadata() {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }

  // Timeline click to seek
  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || duration === 0 || dragStateRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = ratio * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  }

  // Timeline drag for clip handles
  function handleHandleMouseDown(
    e: React.MouseEvent,
    clipId: string,
    side: "start" | "end"
  ) {
    e.stopPropagation();
    e.preventDefault();
    dragStateRef.current = { clipId, side };

    function onMouseMove(ev: MouseEvent) {
      if (!dragStateRef.current || !timelineRef.current || duration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const t = ratio * duration;

      setClips(prev => {
        if (!prev) return prev;
        return prev.map(c => {
          if (c.id !== dragStateRef.current!.clipId) return c;
          if (dragStateRef.current!.side === "start") {
            return { ...c, start_sec: Math.min(t, c.end_sec - 0.5) };
          } else {
            return { ...c, end_sec: Math.max(t, c.start_sec + 0.5) };
          }
        });
      });
    }

    function onMouseUp() {
      if (!dragStateRef.current) return;
      const { clipId: cId, side } = dragStateRef.current;
      dragStateRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      // Persist the change
      setClips(prev => {
        const clip = prev?.find(c => c.id === cId);
        if (clip) {
          const update = side === "start"
            ? { start_sec: clip.start_sec }
            : { end_sec: clip.end_sec };
          fetch(`/api/clips/${cId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(update),
          }).catch(() => undefined);
        }
        return prev;
      });
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const isProcessing =
    data &&
    !TERMINAL_STATUSES.includes(data.status) &&
    data.status !== "pending";

  const activeStep = data ? getActiveStep(data.status) : -1;
  const isCompleted = data?.status === "completed";

  const sortedClips = clips ? [...clips].sort((a, b) => b.score - a.score) : null;
  const selectedClip = clips?.find(c => c.id === selectedClipId) ?? null;

  // Caption overlay: find segment covering currentTime
  const captionSegment = showCaptions && data?.transcript?.segments
    ? (data.transcript.segments as Segment[]).find(
        seg => currentTime >= seg.start && currentTime <= seg.end
      )
    : null;

  const captionText = captionSegment
    ? captionSegment.text.replace(/^\[Speaker \d+\]\s*/, "")
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-gray-800 shrink-0">
        <Link
          href="/dashboard"
          aria-label="Back"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm min-h-[44px] py-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
          onClick={handleDelete}
          className="text-gray-600 hover:text-red-400 transition-colors text-sm px-3 py-2 rounded-lg hover:bg-gray-900 min-h-[44px]"
          title="Delete project"
        >
          🗑 Delete
        </button>
      </header>

      {/* Two-column body */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* LEFT SIDEBAR */}
        <aside className="w-full lg:w-[420px] shrink-0 border-r border-gray-800 overflow-y-auto">
          <div className="px-4 sm:px-5 py-5 flex flex-col gap-5">

            {loading ? (
              <div className="space-y-4">
                <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
                <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
              </div>
            ) : !data ? (
              <p className="text-gray-400">Project not found.</p>
            ) : (
              <>
                {/* Processing stepper */}
                {isProcessing && (
                  <div data-testid="processing-stepper" className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">
                      Processing stages
                    </h2>
                    <ol className="flex flex-col gap-3">
                      {STAGES.map((stage, i) => {
                        const isDone = i < activeStep;
                        const isActive = i === activeStep;
                        return (
                          <li key={stage.label} className="flex items-center gap-3">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                isDone
                                  ? "bg-green-500 text-white"
                                  : isActive
                                  ? "bg-yellow-500 text-white"
                                  : "bg-gray-800 text-gray-500"
                              }`}
                            >
                              {isDone ? (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                i + 1
                              )}
                            </div>
                            <span
                              className={`text-sm ${
                                isDone
                                  ? "text-green-400"
                                  : isActive
                                  ? "text-yellow-400 font-medium"
                                  : "text-gray-500"
                              }`}
                            >
                              {stage.label}
                            </span>
                            {isActive && (
                              <svg className="w-4 h-4 text-yellow-400 animate-spin ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                                <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                              </svg>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Failed state */}
                {data.status === "failed" && (
                  <div className="bg-red-950 border border-red-800 rounded-xl p-5 flex flex-col gap-3">
                    <h2 className="text-red-400 font-semibold">Processing failed</h2>
                    {data.error_message && (
                      <p className="text-red-300 text-sm">{data.error_message}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="self-start rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors min-h-[44px]"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Pending state */}
                {data.status === "pending" && (
                  <div className="text-gray-400 text-sm">
                    Project is queued and will begin processing shortly.
                  </div>
                )}

                {/* Completed section */}
                {isCompleted && (
                  <>
                    {/* Clips header */}
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-white flex-1">✨ AI Clips</h2>
                      {clips && clips.length > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full font-medium">
                          {clips.length} clips
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleGenerateClips}
                        disabled={clipsLoading}
                        data-testid="generate-clips-btn"
                        className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors min-h-[44px]"
                      >
                        {clipsLoading ? "Generating…" : clips && clips.length > 0 ? "Regenerate Clips" : "Generate Clips"}
                      </button>
                    </div>

                    {/* Skeleton loading */}
                    {clipsLoading && (
                      <div className="flex flex-col gap-3">
                        {[0, 1, 2].map(i => (
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
                    )}

                    {/* Empty state */}
                    {!clipsLoading && (clips === null || clips.length === 0) && (
                      <div className="text-center py-14 bg-gray-900 border border-gray-800 rounded-xl flex flex-col items-center gap-4">
                        <p className="text-gray-400 text-sm">No clips yet — generate AI clips from your highlights</p>
                        <button
                          type="button"
                          onClick={handleGenerateClips}
                          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-base font-semibold text-white transition-colors min-h-[44px]"
                        >
                          ✨ Generate AI Clips
                        </button>
                      </div>
                    )}

                    {/* Clips list */}
                    {!clipsLoading && sortedClips && sortedClips.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {sortedClips.map(clip => {
                          const isSelected = clip.id === selectedClipId;
                          const visibleTags = clip.hashtags?.slice(0, 3) ?? [];
                          const extraTagCount = (clip.hashtags?.length ?? 0) - 3;
                          return (
                            <div
                              key={clip.id}
                              onClick={() => {
                                setSelectedClipId(clip.id);
                                seekToClip(clip);
                              }}
                              className={`bg-gray-900 border rounded-xl p-4 transition-all cursor-pointer ${
                                isSelected
                                  ? "border-l-4 border-l-violet-500 border-gray-700"
                                  : clip.status === "approved"
                                  ? "border-l-4 border-l-green-600 border-gray-800"
                                  : clip.status === "rejected"
                                  ? "border-gray-800 opacity-40"
                                  : "border-gray-800 hover:border-gray-700"
                              }`}
                            >
                              {/* Header row: score + title */}
                              <div className="flex items-start gap-2 mb-2">
                                <ScoreBadge score={clip.score} />
                                <p className="text-violet-300 text-sm font-semibold flex-1 min-w-0 line-clamp-2">
                                  {clip.clip_title ?? clip.title ?? "Untitled clip"}
                                </p>
                              </div>

                              {/* Time + duration */}
                              <div className="flex items-center gap-3 mb-2 text-xs text-gray-400 font-mono">
                                <span>{formatTime(clip.start_sec)} → {formatTime(clip.end_sec)}</span>
                                <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
                                  {clip.duration_sec?.toFixed(1) ?? (clip.end_sec - clip.start_sec).toFixed(1)}s
                                </span>
                              </div>

                              {/* Hashtags */}
                              {visibleTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {visibleTags.map(tag => (
                                    <span key={tag} className="text-xs bg-gray-800 text-violet-400 px-2 py-0.5 rounded-full">
                                      {tag}
                                    </span>
                                  ))}
                                  {extraTagCount > 0 && (
                                    <span className="text-xs text-gray-500 px-2 py-0.5">
                                      +{extraTagCount} more
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Controls — stop propagation so card click doesn't fire */}
                              <div
                                className="flex flex-wrap items-center gap-2"
                                onClick={e => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  aria-label="Approve clip"
                                  onClick={() => handleClipAction(clip.id, { status: "approved" })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                                    clip.status === "approved"
                                      ? "bg-green-600 text-white"
                                      : "bg-gray-800 text-gray-300 hover:bg-green-700 hover:text-white"
                                  }`}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  aria-label="Reject clip"
                                  onClick={() => handleClipAction(clip.id, { status: "rejected" })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                                    clip.status === "rejected"
                                      ? "bg-red-700 text-white"
                                      : "bg-gray-800 text-gray-300 hover:bg-red-800 hover:text-white"
                                  }`}
                                >
                                  ✗ Reject
                                </button>

                                <select
                                  aria-label="Caption style"
                                  value={clip.caption_style}
                                  onChange={e => handleClipAction(clip.id, { caption_style: e.target.value as CaptionStyle })}
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
                                  onChange={e => handleClipAction(clip.id, { aspect_ratio: e.target.value })}
                                  className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[44px]"
                                >
                                  <option value="9:16">9:16</option>
                                  <option value="1:1">1:1</option>
                                  <option value="16:9">16:9</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => handleExportClip(clip.id)}
                                  disabled={clip.status === "exporting" || clip.status === "exported"}
                                  className="ml-auto px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors min-h-[44px]"
                                >
                                  {clip.status === "exporting" ? "Exporting…" : clip.status === "exported" ? "Exported ✓" : "Export →"}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Regenerate link */}
                        <div className="flex justify-center pt-1">
                          <button
                            type="button"
                            onClick={handleGenerateClips}
                            disabled={clipsLoading}
                            className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
                          >
                            ↺ Regenerate Clips
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Transcript */}
                    {data.transcript?.segments?.length ? (
                      <CollapsibleSection
                        title="📝 Transcript"
                        open={transcriptOpen}
                        onToggle={() => setTranscriptOpen(o => !o)}
                      >
                        <div className="max-h-96 overflow-y-auto -mx-4 px-4">
                          <div className="flex flex-col gap-2 pt-1">
                            {(data.transcript.segments as Segment[]).map((seg) => {
                              const speakerMatch = seg.text.match(/^\[Speaker (\d+)\]\s*/);
                              const speakerNum = speakerMatch ? parseInt(speakerMatch[1]) : null;
                              const text = speakerMatch ? seg.text.slice(speakerMatch[0].length) : seg.text;
                              const speakerColors = ["text-violet-400", "text-blue-400", "text-green-400", "text-yellow-400", "text-pink-400"];
                              const color = speakerNum !== null ? speakerColors[speakerNum % speakerColors.length] : "text-gray-400";
                              return (
                                <div key={seg.id} className="flex gap-3 text-sm">
                                  <span className="text-gray-500 font-mono text-xs shrink-0 pt-0.5 w-10">
                                    {formatTime(seg.start)}
                                  </span>
                                  {speakerNum !== null && (
                                    <span className={`text-xs font-bold shrink-0 pt-0.5 w-16 ${color}`}>
                                      S{speakerNum}
                                    </span>
                                  )}
                                  <p className="text-gray-300">{text}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CollapsibleSection>
                    ) : null}

                    {/* Downloads */}
                    {artifacts && Object.keys(artifacts).length > 0 && (
                      <CollapsibleSection
                        title="📦 Downloads"
                        open={downloadsOpen}
                        onToggle={() => setDownloadsOpen(o => !o)}
                      >
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Object.entries(artifacts).map(([key, art]) => (
                            art.available ? (
                              <a
                                key={key}
                                href={art.url}
                                download={key === "transcript" || key === "highlights" ? `${key}.json` : undefined}
                                target={key === "video" || key === "audio" ? "_blank" : undefined}
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors border border-gray-700"
                              >
                                <span>{key === "video" ? "🎬" : key === "audio" ? "🎵" : key === "transcript" ? "📝" : "✨"}</span>
                                <span>{art.label}</span>
                                <span className="text-gray-500 text-xs">↓</span>
                              </a>
                            ) : (
                              <span key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-sm text-gray-600 border border-gray-800">
                                <span>{art.label}</span>
                                <span className="text-xs">—</span>
                              </span>
                            )
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                    {/* How it ran */}
                    {data.processing_log?.length > 0 && (
                      <CollapsibleSection
                        title="⚙️ How it ran"
                        open={howItRanOpen}
                        onToggle={() => setHowItRanOpen(o => !o)}
                      >
                        <div className="flex flex-col gap-2 pt-1">
                          {data.processing_log.map((entry, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                              <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                                entry.status === "ok" ? "bg-green-500" :
                                entry.status === "fallback" ? "bg-yellow-500" : "bg-red-500"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-300 font-medium capitalize">{entry.step}</span>
                                {entry.provider && (
                                  <span className="ml-2 text-violet-400 text-xs font-mono">{entry.provider}</span>
                                )}
                                {entry.detail && (
                                  <span className="ml-2 text-gray-500 text-xs truncate">{entry.detail}</span>
                                )}
                              </div>
                              <span className="text-gray-600 text-xs shrink-0">
                                {new Date(entry.ts).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN — video editor */}
        <main className="flex-1 flex flex-col min-w-0 lg:sticky lg:top-0 lg:h-screen">
          {!isCompleted ? (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <p className="text-sm">Video player available once processing completes.</p>
            </div>
          ) : artifacts && artifacts.video && !artifacts.video.available ? (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <p className="text-sm">No video available for this project.</p>
            </div>
          ) : !videoUrl ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="w-8 h-8 text-violet-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                <path strokeLinecap="round" d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
              </svg>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Video */}
              <div className="relative bg-black flex-1 min-h-0 flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="max-h-full max-w-full"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {/* Caption overlay */}
                {captionText && (
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center px-6 pointer-events-none">
                    <span className="bg-black/75 text-white text-sm font-medium px-3 py-1.5 rounded-lg text-center max-w-lg">
                      {captionText}
                    </span>
                  </div>
                )}
              </div>

              {/* Timeline scrubber */}
              <div
                ref={timelineRef}
                className="relative h-20 bg-gray-900 border-t border-gray-800 cursor-pointer shrink-0"
                onClick={handleTimelineClick}
              >
                {/* Clip bars */}
                {sortedClips && duration > 0 && sortedClips.map(clip => {
                  const left = (clip.start_sec / duration) * 100;
                  const width = ((clip.end_sec - clip.start_sec) / duration) * 100;
                  const isSelected = clip.id === selectedClipId;
                  const barColor =
                    clip.status === "approved" ? "bg-green-600/60" :
                    clip.status === "rejected" ? "bg-gray-700/40" :
                    isSelected ? "bg-violet-500/70" :
                    "bg-violet-600/50";
                  return (
                    <div
                      key={clip.id}
                      className={`absolute top-2 bottom-2 rounded ${barColor} ${isSelected ? "z-10" : "z-0"}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        seekToClip(clip);
                      }}
                    >
                      {/* Left drag handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center"
                        onMouseDown={e => handleHandleMouseDown(e, clip.id, "start")}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="w-1 h-6 bg-white/60 rounded-full" />
                      </div>
                      {/* Right drag handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center"
                        onMouseDown={e => handleHandleMouseDown(e, clip.id, "end")}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="w-1 h-6 bg-white/60 rounded-full" />
                      </div>
                    </div>
                  );
                })}

                {/* Playhead */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white z-20 pointer-events-none"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                )}

                {/* Time labels */}
                <div className="absolute bottom-1 left-2 text-xs text-gray-600 font-mono pointer-events-none">
                  {formatTime(currentTime)}
                </div>
                <div className="absolute bottom-1 right-2 text-xs text-gray-600 font-mono pointer-events-none">
                  {formatTime(duration)}
                </div>
              </div>

              {/* Controls */}
              <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex flex-col gap-2">
                {/* Row 1 */}
                <div className="flex items-center gap-3">
                  {/* Skip prev */}
                  <button
                    type="button"
                    onClick={skipPrev}
                    aria-label="Previous clip"
                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                    </svg>
                  </button>

                  {/* Play/Pause */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                  >
                    {isPlaying ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Skip next */}
                  <button
                    type="button"
                    onClick={skipNext}
                    aria-label="Next clip"
                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18l8.5-6L6 6v12zm2.5-6l5.5-3.9v7.8L8.5 12zM16 6h2v12h-2z" />
                    </svg>
                  </button>

                  {/* Time display */}
                  <span className="text-xs text-gray-400 font-mono ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex-1" />

                  {/* Loop */}
                  <button
                    type="button"
                    onClick={() => setIsLooping(l => !l)}
                    aria-label="Loop"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isLooping
                        ? "bg-violet-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    🔁 Loop
                  </button>

                  {/* Play All / Stop */}
                  {isPreviewing ? (
                    <button
                      type="button"
                      onClick={stopPreviewing}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors"
                    >
                      ⏹ Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                      ▶ Play All
                    </button>
                  )}
                </div>

                {/* Row 2 */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCaptions(c => !c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      showCaptions
                        ? "bg-violet-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    Captions {showCaptions ? "On" : "Off"}
                  </button>

                  {selectedClip && (
                    <span className="text-xs text-gray-500 truncate">
                      {selectedClip.clip_title ?? selectedClip.title ?? "Untitled clip"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
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
