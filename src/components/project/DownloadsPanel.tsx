"use client";

import React from "react";
import { Clip } from "./types";

export interface DownloadsPanelProps {
  clips: Clip[];
  projectTitle: string;
  stitchUrl?: string | null;
}

function DownloadButton({
  clipId,
  href,
  label,
}: {
  clipId?: string;
  href?: string;
  label: string;
}) {
  const url = clipId ? `/api/clips/${clipId}/download` : (href ?? "#");
  return (
    <a
      href={url}
      download={`${label}.mp4`}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold text-white transition-colors min-h-[36px] shrink-0"
      aria-label={`Download ${label}`}
    >
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download
    </a>
  );
}

function ClipStatusBadge({ status }: { status: Clip["status"] }) {
  if (status === "exported") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400 font-medium shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        Exported
      </span>
    );
  }
  if (status === "exporting") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium shrink-0">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
          <path
            strokeLinecap="round"
            d="M4 12a8 8 0 018-8"
            strokeWidth="4"
            className="opacity-75"
          />
        </svg>
        Exporting…
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="flex items-center gap-1 text-xs text-violet-400 font-medium shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
        Kept
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-600 font-medium shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
        Skipped
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
      Pending
    </span>
  );
}

export function DownloadsPanel({ clips, projectTitle, stitchUrl }: DownloadsPanelProps) {
  // Show all clips (except truly skipped ones) sorted: exported first, then exporting, then rest
  const relevant = clips
    .filter((c) => c.status !== "rejected")
    .sort((a, b) => {
      const order: Record<string, number> = { exported: 0, exporting: 1, approved: 2, pending: 3 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

  const exportedCount = clips.filter((c) => c.status === "exported").length;
  const exportingCount = clips.filter((c) => c.status === "exporting").length;

  return (
    <section aria-label="Exports">
      {/* Stitched export */}
      {stitchUrl && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Stitched
          </p>
          <article className="flex items-center gap-3 py-2 px-3 bg-violet-900/40 rounded-lg border border-violet-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{projectTitle} — stitched</p>
              <p className="text-xs text-gray-400">{exportedCount} clips combined</p>
            </div>
            <DownloadButton href={stitchUrl} label={`${projectTitle}-stitched`} />
          </article>
        </div>
      )}

      {/* Summary counts */}
      {relevant.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">
            Clips
          </p>
          <span className="text-xs text-gray-500">
            {exportedCount > 0 && <span className="text-green-400">{exportedCount} exported</span>}
            {exportedCount > 0 && exportingCount > 0 && <span className="mx-1">·</span>}
            {exportingCount > 0 && (
              <span className="text-yellow-400">{exportingCount} exporting</span>
            )}
          </span>
        </div>
      )}

      {relevant.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No clips yet — generate and keep clips to export them
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {relevant.map((clip) => {
            const dur = (clip.end_sec - clip.start_sec).toFixed(1);
            const name = clip.clip_title ?? clip.title ?? "Untitled clip";
            return (
              <li key={clip.id}>
                <article
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg border ${clip.status === "exported" ? "bg-gray-800/50 border-gray-700" : clip.status === "exporting" ? "bg-yellow-900/20 border-yellow-800/50" : "bg-gray-900/50 border-gray-800"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${clip.status === "exported" ? "text-white" : "text-gray-400"}`}
                    >
                      {name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 font-mono">{dur}s</span>
                      <ClipStatusBadge status={clip.status} />
                    </div>
                  </div>
                  {clip.status === "exported" && <DownloadButton clipId={clip.id} label={name} />}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
