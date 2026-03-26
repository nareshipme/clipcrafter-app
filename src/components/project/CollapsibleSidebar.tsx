"use client";

import React from "react";
import { Artifact, Clip, Segment, StatusData } from "./types";
import { DownloadsPanel } from "./DownloadsPanel";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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

function TranscriptSection({
  data,
  open,
  onToggle,
}: {
  data: StatusData;
  open: boolean;
  onToggle: () => void;
}) {
  if (!data.transcript?.segments?.length) return null;
  const speakerColors = [
    "text-violet-400",
    "text-blue-400",
    "text-green-400",
    "text-yellow-400",
    "text-pink-400",
  ];
  return (
    <CollapsibleSection title="📝 Transcript" open={open} onToggle={onToggle}>
      <div className="max-h-96 overflow-y-auto -mx-4 px-4">
        <div className="flex flex-col gap-2 pt-1">
          {(data.transcript.segments as Segment[]).map((seg) => {
            const m = seg.text.match(/^\[Speaker (\d+)\]\s*/);
            const speakerNum = m ? parseInt(m[1]) : null;
            const text = m ? seg.text.slice(m[0].length) : seg.text;
            const color =
              speakerNum !== null
                ? speakerColors[speakerNum % speakerColors.length]
                : "text-gray-400";
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
  );
}

function artifactIcon(key: string): string {
  if (key === "video") return "🎬";
  if (key === "audio") return "🎵";
  if (key === "transcript") return "📝";
  return "✨";
}

function DownloadsSection({
  artifacts,
  clips,
  projectTitle,
  stitchUrl,
  open,
  onToggle,
}: {
  artifacts: Record<string, Artifact>;
  clips?: Clip[];
  projectTitle?: string;
  stitchUrl?: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <CollapsibleSection title="📦 Downloads" open={open} onToggle={onToggle}>
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(artifacts).map(([key, art]) =>
          art.available ? (
            <a
              key={key}
              href={art.url}
              download={key === "transcript" || key === "highlights" ? `${key}.json` : undefined}
              target={key === "video" || key === "audio" ? "_blank" : undefined}
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors border border-gray-700"
            >
              <span>{artifactIcon(key)}</span>
              <span>{art.label}</span>
              <span className="text-gray-500 text-xs">↓</span>
            </a>
          ) : (
            <span
              key={key}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-sm text-gray-600 border border-gray-800"
            >
              <span>{art.label}</span>
              <span className="text-xs">—</span>
            </span>
          )
        )}
      </div>
      {(clips && clips.length > 0) || stitchUrl ? (
        <DownloadsPanel
          clips={clips ?? []}
          projectTitle={projectTitle ?? ""}
          stitchUrl={stitchUrl}
        />
      ) : null}
    </CollapsibleSection>
  );
}

function HowItRanSection({
  data,
  open,
  onToggle,
}: {
  data: StatusData;
  open: boolean;
  onToggle: () => void;
}) {
  if (!data.processing_log?.length) return null;
  return (
    <CollapsibleSection title="⚙️ How it ran" open={open} onToggle={onToggle}>
      <div className="flex flex-col gap-2 pt-1">
        {data.processing_log.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span
              className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${entry.status === "ok" ? "bg-green-500" : entry.status === "fallback" ? "bg-yellow-500" : "bg-red-500"}`}
            />
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
  );
}

export interface CollapsibleSidebarProps {
  data: StatusData;
  artifacts: Record<string, Artifact> | null;
  clips?: Clip[];
  projectTitle?: string;
  stitchUrl?: string | null;
  transcriptOpen: boolean;
  downloadsOpen: boolean;
  howItRanOpen: boolean;
  onToggleTranscript: () => void;
  onToggleDownloads: () => void;
  onToggleHowItRan: () => void;
}

export function CollapsibleSidebar({
  data,
  artifacts,
  clips,
  projectTitle,
  stitchUrl,
  transcriptOpen,
  downloadsOpen,
  howItRanOpen,
  onToggleTranscript,
  onToggleDownloads,
  onToggleHowItRan,
}: CollapsibleSidebarProps) {
  return (
    <>
      <TranscriptSection data={data} open={transcriptOpen} onToggle={onToggleTranscript} />
      {artifacts && Object.keys(artifacts).length > 0 && (
        <DownloadsSection
          artifacts={artifacts}
          clips={clips}
          projectTitle={projectTitle}
          stitchUrl={stitchUrl}
          open={downloadsOpen}
          onToggle={onToggleDownloads}
        />
      )}
      <HowItRanSection data={data} open={howItRanOpen} onToggle={onToggleHowItRan} />
    </>
  );
}
