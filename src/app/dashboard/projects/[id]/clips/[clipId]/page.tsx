"use client";

import { use } from "react";
import Link from "next/link";
import { TwickTimeline } from "@/components/project/TwickTimeline";
import { ClipVideoPlayer } from "@/components/editor/ClipVideoPlayer";
import { ClipEditPanel } from "@/components/editor/ClipEditPanel";
import { useClipEditor } from "@/components/editor/useClipEditor";
import type { Clip } from "@/components/project/types";

// ── Back bar ──────────────────────────────────────────────────────────────────

function BackBar({ projectId, title }: { projectId: string; title: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
      <Link
        href={`/dashboard/projects/${projectId}/studio`}
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors shrink-0"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back to project
      </Link>
      <span className="text-gray-700 select-none">|</span>
      <span className="text-sm text-gray-300 truncate flex-1 min-w-0">{title || "Untitled clip"}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClipEditorPage({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const { id: projectId, clipId } = use(params);
  const editor = useClipEditor(projectId, clipId);

  if (editor.loading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="h-6 w-36 bg-gray-800 rounded animate-pulse" />
        <div className="h-80 bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!editor.data) return <p className="p-6 text-gray-400">Clip not found.</p>;

  const liveClip: Clip = {
    ...editor.data.clip,
    start_sec: editor.startSec,
    end_sec: editor.endSec,
    duration_sec: editor.endSec - editor.startSec,
    clip_title: editor.title || editor.data.clip.clip_title,
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-950">
      <BackBar projectId={projectId} title={editor.title} />

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Player — 60% on desktop */}
        <div className="lg:w-[60%] aspect-video lg:aspect-auto bg-black relative min-h-[200px] lg:min-h-[400px]">
          <ClipVideoPlayer
            videoSrc={editor.data.videoUrl}
            startSec={editor.startSec}
            endSec={editor.endSec}
            captions={editor.data.captions}
            captionPosition={editor.captionPosition}
            captionSize={editor.captionSize}
            currentTime={editor.currentTime}
            onTimeUpdate={editor.setCurrentTime}
            onDurationLoaded={editor.setVideoDuration}
          />
        </div>

        {/* Edit panel — 40% on desktop */}
        <ClipEditPanel
          projectId={projectId}
          clipId={clipId}
          editor={editor}
        />
      </div>

      {editor.videoDuration > 0 && (
        <TwickTimeline
          clips={[liveClip]}
          duration={editor.videoDuration}
          currentTime={editor.currentTime}
          selectedClipIds={new Set([clipId])}
          selectedTopic={null}
          onSeek={editor.setCurrentTime}
          onClipTrimmed={editor.handleClipTrimmed}
        />
      )}
    </div>
  );
}
