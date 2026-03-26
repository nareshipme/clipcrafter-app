"use client";

import React from "react";
import { Clip } from "./types";

export interface DownloadsPanelProps {
  clips: Clip[];
  projectTitle: string;
  stitchUrl?: string | null;
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
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

export function DownloadsPanel({ clips, projectTitle, stitchUrl }: DownloadsPanelProps) {
  const exported = clips.filter((c) => c.status === "exported" && c.export_url);
  const hasAnything = exported.length > 0 || stitchUrl;

  if (!hasAnything) {
    return (
      <section aria-label="Downloads">
        <p className="text-sm text-gray-500 py-2 italic">
          No exports yet — select clips and click Export
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Downloads">
      {/* Stitched export */}
      {stitchUrl && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Stitched Export
          </p>
          <article className="flex items-center gap-3 py-2 px-3 bg-violet-900/40 rounded-lg border border-violet-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{projectTitle} — stitched</p>
              <p className="text-xs text-gray-400">{exported.length} clips combined</p>
            </div>
            <DownloadButton href={stitchUrl} label={`${projectTitle}-stitched`} />
          </article>
        </div>
      )}

      {/* Individual clip exports */}
      {exported.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Individual Clips
          </p>
          <ul className="flex flex-col gap-2">
            {exported.map((clip) => {
              const dur = (clip.end_sec - clip.start_sec).toFixed(1);
              const name = clip.clip_title ?? clip.title ?? "Untitled clip";
              return (
                <li key={clip.id}>
                  <article className="flex items-center gap-3 py-2 px-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{name}</p>
                      <p className="text-xs text-gray-400">{dur}s</p>
                    </div>
                    <DownloadButton href={clip.export_url!} label={name} />
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
