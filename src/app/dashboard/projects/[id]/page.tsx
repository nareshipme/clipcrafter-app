"use client";

import { use, useEffect, useState, useCallback } from "react";
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

interface Highlight {
  start: number;
  end: number;
  text: string;
  reason: string;
  score?: number;
  score_reason?: string;
  hashtags?: string[];
  clip_title?: string;
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
  highlights: { id: string; segments: Highlight[] } | null;
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

type TabKey = "highlights" | "clips" | "captions" | "transcript";
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

function captionSegmentClass(style: CaptionStyle): string {
  if (style === "hormozi") return "bg-black text-yellow-400 font-black";
  if (style === "modern") return "bg-gray-900 text-white font-medium";
  if (style === "neon") return "bg-gray-950 text-green-400 font-bold";
  return "bg-transparent text-white font-normal";
}

// Exported for testing
export function ProjectDetailContent({ id }: { id: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact> | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("highlights");
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("hormozi");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/status`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.status === "completed" && !artifacts) {
          fetch(`/api/projects/${id}/artifacts`)
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setArtifacts(d.artifacts))
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

  // Load clips when switching to clips tab
  useEffect(() => {
    if (activeTab === "clips" && data?.status === "completed" && clips === null) {
      fetch(`/api/projects/${id}/clips`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setClips(d.clips))
        .catch(() => undefined);
    }
  }, [activeTab, data?.status, clips, id]);

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
        setClips(json.clips);
      }
    } finally {
      setClipsLoading(false);
    }
  }

  async function handleClipAction(clipId: string, update: Partial<Pick<Clip, "status" | "caption_style" | "aspect_ratio">>) {
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

  async function handleApplyStyleToAll() {
    if (!clips?.length) return;
    await Promise.all(
      clips.map(c => handleClipAction(c.id, { caption_style: captionStyle }))
    );
  }

  const isProcessing =
    data &&
    !TERMINAL_STATUSES.includes(data.status) &&
    data.status !== "pending";

  const activeStep = data ? getActiveStep(data.status) : -1;
  const isCompleted = data?.status === "completed";

  const TABS: { key: TabKey; label: string }[] = [
    { key: "highlights", label: "✨ Highlights" },
    { key: "clips", label: "🎬 Clips" },
    { key: "captions", label: "💬 Caption Studio" },
    { key: "transcript", label: "📝 Transcript" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-gray-800">
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
        <button
          type="button"
          onClick={handleDelete}
          className="text-gray-600 hover:text-red-400 transition-colors text-sm px-3 py-2 rounded-lg hover:bg-gray-900 min-h-[44px]"
          title="Delete project"
        >
          🗑 Delete
        </button>
      </header>

      <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
          </div>
        ) : !data ? (
          <p className="text-gray-400">Project not found.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Status badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white">Project</h1>
              <span
                data-testid="status-badge"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusBadgeClass(data.status)}`}
              >
                {data.status}
              </span>
            </div>

            {/* Processing stepper */}
            {(isProcessing || isCompleted) && (
              <div data-testid="processing-stepper" className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">
                  Processing stages
                </h2>
                <ol className="flex flex-col gap-3">
                  {STAGES.map((stage, i) => {
                    const isDone = data.status === "completed" || i < activeStep;
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

            {/* Completed — artifacts + tabs */}
            {isCompleted && (
              <div className="flex flex-col gap-6 mt-2">

                {/* Artifacts — download links */}
                {artifacts && Object.keys(artifacts).length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">📦 Outputs</h2>
                    <div className="flex flex-wrap gap-2">
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
                  </div>
                )}

                {/* Processing log */}
                {data.processing_log?.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">⚙️ How it ran</h2>
                    <div className="flex flex-col gap-2">
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
                  </div>
                )}

                {/* Tabs */}
                <div>
                  <div className="flex gap-1 border-b border-gray-800 mb-5 overflow-x-auto">
                    {TABS.map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                          activeTab === tab.key
                            ? "border-b-2 border-violet-500 text-white"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Highlights tab */}
                  {activeTab === "highlights" && (
                    data.highlights?.segments?.length ? (
                      <div className="flex flex-col gap-3">
                        {(data.highlights.segments as Highlight[]).map((h, i) => (
                          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs text-violet-400 font-mono">
                                {formatTime(h.start)} → {formatTime(h.end)}
                              </span>
                              {h.score !== undefined && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(h.score)}`}>
                                  {h.score}
                                </span>
                              )}
                            </div>
                            {h.clip_title && (
                              <p className="text-violet-300 text-sm font-semibold mb-1">{h.clip_title}</p>
                            )}
                            <p className="text-white text-sm font-medium mb-1">&ldquo;{h.text}&rdquo;</p>
                            <p className="text-gray-400 text-xs mb-2">{h.reason}</p>
                            {h.hashtags && h.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {h.hashtags.map(tag => (
                                  <span key={tag} className="text-xs bg-gray-800 text-violet-400 px-2 py-0.5 rounded-full">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">No highlights generated.</div>
                    )
                  )}

                  {/* Clips tab */}
                  {activeTab === "clips" && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={handleGenerateClips}
                          disabled={clipsLoading}
                          data-testid="generate-clips-btn"
                          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors min-h-[44px]"
                        >
                          {clipsLoading ? "Generating…" : "Generate Clips"}
                        </button>
                        {clips && clips.length > 0 && (
                          <span className="text-gray-500 text-xs">{clips.length} clips</span>
                        )}
                      </div>

                      {clipsLoading && (
                        <div className="flex flex-col gap-3">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
                              <div className="h-4 w-24 bg-gray-800 rounded mb-2" />
                              <div className="h-3 w-full bg-gray-800 rounded mb-1" />
                              <div className="h-3 w-3/4 bg-gray-800 rounded" />
                            </div>
                          ))}
                        </div>
                      )}

                      {!clipsLoading && clips === null && (
                        <div className="text-center py-12 text-gray-500 text-sm">
                          No clips yet — click Generate Clips
                        </div>
                      )}

                      {!clipsLoading && clips !== null && clips.length === 0 && (
                        <div className="text-center py-12 text-gray-500 text-sm">
                          No clips generated yet.
                        </div>
                      )}

                      {!clipsLoading && clips && clips.length > 0 && (
                        <div className="flex flex-col gap-3">
                          {[...clips]
                            .sort((a, b) => b.score - a.score)
                            .map(clip => (
                              <div
                                key={clip.id}
                                className={`bg-gray-900 border rounded-xl p-4 transition-colors ${
                                  clip.status === "approved"
                                    ? "border-green-600"
                                    : clip.status === "rejected"
                                    ? "border-gray-800 opacity-50"
                                    : "border-gray-800"
                                }`}
                              >
                                {/* Header row */}
                                <div className="flex items-start gap-2 flex-wrap mb-2">
                                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(clip.score)}`}>
                                    {clip.score}
                                  </span>
                                  <span className="text-violet-300 text-sm font-semibold flex-1 min-w-0">
                                    {clip.clip_title ?? clip.title ?? "Untitled clip"}
                                  </span>
                                </div>

                                {/* Time + duration */}
                                <div className="flex items-center gap-3 mb-2 text-xs text-gray-400 font-mono">
                                  <span>{formatTime(clip.start_sec)} → {formatTime(clip.end_sec)}</span>
                                  <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
                                    {clip.duration_sec?.toFixed(1) ?? (clip.end_sec - clip.start_sec).toFixed(1)}s
                                  </span>
                                </div>

                                {/* Hashtags */}
                                {clip.hashtags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {clip.hashtags.map(tag => (
                                      <span key={tag} className="text-xs bg-gray-800 text-violet-400 px-2 py-0.5 rounded-full">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Controls */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Approve / Reject */}
                                  <button
                                    type="button"
                                    aria-label="Approve clip"
                                    onClick={() => handleClipAction(clip.id, { status: "approved" })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
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
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                                      clip.status === "rejected"
                                        ? "bg-red-700 text-white"
                                        : "bg-gray-800 text-gray-300 hover:bg-red-800 hover:text-white"
                                    }`}
                                  >
                                    ✗ Reject
                                  </button>

                                  {/* Caption style */}
                                  <select
                                    aria-label="Caption style"
                                    value={clip.caption_style}
                                    onChange={e => handleClipAction(clip.id, { caption_style: e.target.value as CaptionStyle })}
                                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[36px]"
                                  >
                                    <option value="hormozi">Hormozi</option>
                                    <option value="modern">Modern</option>
                                    <option value="neon">Neon</option>
                                    <option value="minimal">Minimal</option>
                                  </select>

                                  {/* Aspect ratio */}
                                  <select
                                    aria-label="Aspect ratio"
                                    value={clip.aspect_ratio}
                                    onChange={e => handleClipAction(clip.id, { aspect_ratio: e.target.value })}
                                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 min-h-[36px]"
                                  >
                                    <option value="9:16">9:16</option>
                                    <option value="1:1">1:1</option>
                                    <option value="16:9">16:9</option>
                                  </select>

                                  {/* Export */}
                                  <button
                                    type="button"
                                    onClick={() => handleExportClip(clip.id)}
                                    disabled={clip.status === "exporting" || clip.status === "exported"}
                                    className="ml-auto px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors min-h-[36px]"
                                  >
                                    {clip.status === "exporting" ? "Exporting…" : clip.status === "exported" ? "Exported ✓" : "Export"}
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Caption Studio tab */}
                  {activeTab === "captions" && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-sm text-gray-400 font-medium">Style:</label>
                        <select
                          value={captionStyle}
                          onChange={e => setCaptionStyle(e.target.value as CaptionStyle)}
                          className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 min-h-[44px]"
                        >
                          <option value="hormozi">Hormozi — yellow on black</option>
                          <option value="modern">Modern — white on dark</option>
                          <option value="neon">Neon — green glow</option>
                          <option value="minimal">Minimal — clean white</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleApplyStyleToAll}
                          className="px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm font-semibold text-white transition-colors min-h-[44px]"
                        >
                          Apply to all clips
                        </button>
                      </div>

                      {data.transcript?.segments?.length ? (
                        <div className="max-h-[520px] overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-4">
                          <div className="flex flex-col gap-2">
                            {(data.transcript.segments as Segment[]).map(seg => {
                              const speakerMatch = seg.text.match(/^\[Speaker (\d+)\]\s*/);
                              const text = speakerMatch ? seg.text.slice(speakerMatch[0].length) : seg.text;
                              return (
                                <div key={seg.id} className="flex gap-3 items-start">
                                  <span className="text-gray-600 font-mono text-xs shrink-0 pt-1 w-10">
                                    {formatTime(seg.start)}
                                  </span>
                                  <span className={`text-sm px-2 py-1 rounded ${captionSegmentClass(captionStyle)}`}>
                                    {text}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">No transcript segments available.</div>
                      )}
                    </div>
                  )}

                  {/* Transcript tab */}
                  {activeTab === "transcript" && (
                    data.transcript?.segments?.length ? (
                      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-96 overflow-y-auto">
                        <div className="flex flex-col gap-2">
                          {(data.transcript.segments as Segment[]).map((seg) => {
                            const speakerMatch = seg.text.match(/^\[Speaker (\d+)\]\s*/);
                            const speakerNum = speakerMatch ? parseInt(speakerMatch[1]) : null;
                            const text = speakerMatch ? seg.text.slice(speakerMatch[0].length) : seg.text;
                            const speakerColors = ["text-violet-400","text-blue-400","text-green-400","text-yellow-400","text-pink-400"];
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
                    ) : (
                      <div className="text-gray-500 text-sm">No transcript available.</div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
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
