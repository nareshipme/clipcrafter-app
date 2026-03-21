"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";

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
}

interface StatusData {
  id: string;
  status: ProjectStatus;
  error_message: string | null;
  completed_at: string | null;
  transcript: { id: string; segments: Segment[] } | null;
  highlights: { id: string; segments: Highlight[] } | null;
}

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

// Exported for testing
export function ProjectDetailContent({ id }: { id: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/status`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!data || TERMINAL_STATUSES.includes(data.status)) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [data, fetchStatus]);

  async function handleRetry() {
    await fetch(`/api/projects/${id}/process`, { method: "POST" });
    setLoading(true);
    fetchStatus();
  }

  const isProcessing =
    data &&
    !TERMINAL_STATUSES.includes(data.status) &&
    data.status !== "pending";

  const activeStep = data ? getActiveStep(data.status) : -1;

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
        <span className="text-lg font-bold text-white">ClipCrafter</span>
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
            {(isProcessing || data.status === "completed") && (
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

            {/* Completed — transcript + highlights */}
            {data.status === "completed" && (
              <div className="flex flex-col gap-6 mt-2">

                {/* Highlights */}
                {data.highlights?.segments?.length ? (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">✨ Highlights</h2>
                    <div className="flex flex-col gap-3">
                      {(data.highlights.segments as Highlight[]).map((h, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-violet-400 font-mono">
                              {formatTime(h.start)} → {formatTime(h.end)}
                            </span>
                          </div>
                          <p className="text-white text-sm font-medium mb-1">&ldquo;{h.text}&rdquo;</p>
                          <p className="text-gray-400 text-xs">{h.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No highlights generated.</div>
                )}

                {/* Transcript */}
                {data.transcript?.segments?.length ? (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">📝 Transcript</h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-96 overflow-y-auto">
                      <div className="flex flex-col gap-2">
                        {(data.transcript.segments as Segment[]).map((seg) => (
                          <div key={seg.id} className="flex gap-3 text-sm">
                            <span className="text-gray-500 font-mono text-xs shrink-0 pt-0.5">
                              {formatTime(seg.start)}
                            </span>
                            <p className="text-gray-300">{seg.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No transcript available.</div>
                )}
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
