"use client";

import React, { useState } from "react";
import { Clip } from "./types";

export interface ClipTimingEditorProps {
  clip: Clip;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClipAction: (clipId: string, update: Partial<Pick<Clip, "start_sec" | "end_sec">>) => void;
}

export function ClipTimingEditor({ clip, videoRef, onClipAction }: ClipTimingEditorProps) {
  // Track the in-progress typed value only while the field is focused.
  // When not editing, display is derived directly from the prop so DB round-trips
  // are reflected without needing to sync state via effects or refs.
  const [startEdit, setStartEdit] = useState<string | null>(null);
  const [endEdit, setEndEdit] = useState<string | null>(null);

  const startDisplay = startEdit ?? clip.start_sec.toFixed(1);
  const endDisplay = endEdit ?? clip.end_sec.toFixed(1);

  function commitStart(raw: string) {
    const v = parseFloat(raw);
    setStartEdit(null);
    if (isNaN(v)) return;
    const clamped = Math.max(0, Math.min(v, clip.end_sec - 0.5));
    if (videoRef.current) videoRef.current.currentTime = clamped;
    if (clamped !== clip.start_sec) onClipAction(clip.id, { start_sec: clamped });
  }

  function commitEnd(raw: string) {
    const v = parseFloat(raw);
    setEndEdit(null);
    if (isNaN(v)) return;
    let clamped = Math.max(clip.start_sec + 0.5, v);
    if (videoRef.current?.duration) {
      clamped = Math.min(clamped, videoRef.current.duration);
    }
    if (videoRef.current) videoRef.current.currentTime = clamped;
    if (clamped !== clip.end_sec) onClipAction(clip.id, { end_sec: clamped });
  }

  return (
    <div className="flex items-center gap-2 ml-5">
      <label className="text-xs text-gray-500 w-8 shrink-0">Start</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={startDisplay}
        onFocus={() => setStartEdit(clip.start_sec.toFixed(1))}
        onChange={(e) => {
          setStartEdit(e.target.value);
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && videoRef.current) videoRef.current.currentTime = v;
        }}
        onBlur={(e) => commitStart(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitStart((e.target as HTMLInputElement).value);
        }}
        className="w-20 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 font-mono focus:border-violet-500 outline-none"
      />
      <label className="text-xs text-gray-500 w-5 shrink-0">End</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={endDisplay}
        onFocus={() => setEndEdit(clip.end_sec.toFixed(1))}
        onChange={(e) => {
          setEndEdit(e.target.value);
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && videoRef.current) videoRef.current.currentTime = v;
        }}
        onBlur={(e) => commitEnd(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitEnd((e.target as HTMLInputElement).value);
        }}
        className="w-20 bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 font-mono focus:border-violet-500 outline-none"
      />
      <span className="text-xs text-gray-500 font-mono">
        {(clip.end_sec - clip.start_sec).toFixed(1)}s
      </span>
    </div>
  );
}

export interface ClipTopicEditorProps {
  topic: string;
  originalTopic: string;
  onUpdateTopicLabel: (original: string, newLabel: string) => void;
}

export function ClipTopicEditor({
  topic,
  originalTopic,
  onUpdateTopicLabel,
}: ClipTopicEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(topic);

  function commit() {
    const trimmed = editVal.trim();
    const value = trimmed || originalTopic;
    onUpdateTopicLabel(originalTopic, value);
    setIsEditing(false);
  }

  function cancel() {
    setEditVal(topic);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        type="text"
        autoFocus
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        className="text-xs bg-violet-900/80 text-violet-200 border border-violet-500 px-2 py-0.5 rounded-full outline-none w-32"
      />
    );
  }

  return (
    <span
      className="group inline-flex items-center gap-1 text-xs bg-violet-900/50 text-violet-300 border border-violet-700/50 px-2 py-0.5 rounded-full cursor-pointer hover:border-violet-500 transition-colors"
      onClick={() => {
        setEditVal(topic);
        setIsEditing(true);
      }}
    >
      🏷 {topic}
      <svg
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </span>
  );
}
