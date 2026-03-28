"use client";

import { useRef, useState } from "react";
import { Clip } from "./types";

export function useProjectState() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youTubeVideoId, setYouTubeVideoId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [withCaptions, setWithCaptions] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [topicOverrides, setTopicOverrides] = useState<Record<string, string>>({});
  const [clipCount, setClipCount] = useState<number | "auto">("auto");
  const [clipPrompt, setClipPrompt] = useState("");
  const [clipTargetDuration, setClipTargetDuration] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ clipId: string; side: "start" | "end" } | null>(null);
  const previewClipIndexRef = useRef(0);
  const previewClipsRef = useRef<Clip[]>([]);

  return {
    videoUrl,
    setVideoUrl,
    isYouTube,
    setIsYouTube,
    youTubeVideoId,
    setYouTubeVideoId,
    duration,
    setDuration,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    isLooping,
    setIsLooping,
    showCaptions,
    setShowCaptions,
    isPreviewing,
    setIsPreviewing,
    transcriptOpen,
    setTranscriptOpen,
    downloadsOpen,
    setDownloadsOpen,
    selectedClipIds,
    setSelectedClipIds,
    withCaptions,
    setWithCaptions,
    viewMode,
    setViewMode,
    topicOverrides,
    setTopicOverrides,
    clipCount,
    setClipCount,
    clipPrompt,
    setClipPrompt,
    clipTargetDuration,
    setClipTargetDuration,
    videoRef,
    timelineRef,
    dragStateRef,
    previewClipIndexRef,
    previewClipsRef,
  };
}
