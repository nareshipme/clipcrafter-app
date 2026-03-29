"use client";

import { useRef, useState, useCallback } from "react";
import { Artifact, Clip, StatusData } from "./types";
import {
  makeHandleRetry,
  makeHandleDelete,
  makeHandleGenerateClips,
  makeHandleClipAction,
  makeHandleExportClip,
  makeHandleExportBatch,
  makeHandleStitchExport,
} from "./projectHandlers";
import {
  makeSeekToClip,
  makeTogglePlay,
  makeSkipTo,
  makeHandlePlayAll,
  makeHandleTimeUpdate,
  makeHandleTimelineClick,
  makeHandleHandleMouseDown,
} from "./videoControls";
import { useLoadArtifacts, useArtifactRefresh } from "./useDataFetchers";
import { useFetchClips } from "./useFetchClips";
import {
  useStatusPolling,
  useClipsPolling,
  useAutoSelectClips,
  useExportPolling,
} from "./usePollingEffects";
import { useProjectState } from "./useProjectState";

export type { ProjectDataResult } from "./projectDataTypes";
import type { ProjectDataResult } from "./projectDataTypes";

type ProjectState = ReturnType<typeof useProjectState>;

interface LocalState {
  data: StatusData | null;
  loading: boolean;
  artifacts: Record<string, Artifact> | null;
  clips: Clip[] | null;
  clipsStatus: string;
  selectedTopic: string | null;
  setSelectedTopic: (t: string | null) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
}

interface LocalRefs {
  selectedClipIdRef: React.MutableRefObject<string | null>;
  durationRef: React.MutableRefObject<number>;
  isLoopingRef: React.MutableRefObject<boolean>;
  isPreviewingRef: React.MutableRefObject<boolean>;
  clipsRef: React.MutableRefObject<Clip[] | null>;
}

interface ProjectHandlerOpts {
  id: string;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  fetchStatus: () => Promise<void>;
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>;
  setClipsStatus: React.Dispatch<React.SetStateAction<string>>;
  setSelectedTopic: (t: string | null) => void;
  s: Pick<
    ProjectState,
    "clipCount" | "clipPrompt" | "clipTargetDuration" | "selectedClipIds" | "withCaptions"
  >;
}

function buildProjectHandlers(opts: ProjectHandlerOpts) {
  const { id, setLoading, fetchStatus, setClips, setClipsStatus, setSelectedTopic, s } = opts;
  return {
    handleRetry: makeHandleRetry(id, { setLoading, fetchStatus }),
    handleDelete: makeHandleDelete(id),
    handleGenerateClips: makeHandleGenerateClips(
      id,
      () => ({
        clipCount: s.clipCount,
        clipPrompt: s.clipPrompt,
        clipTargetDuration: s.clipTargetDuration,
      }),
      { setClips, setClipsStatus, setSelectedTopic }
    ),
    handleClipAction: makeHandleClipAction(setClips),
    handleExportClip: makeHandleExportClip(setClips),
    handleExportBatch: makeHandleExportBatch(
      id,
      () => ({ selectedClipIds: s.selectedClipIds, withCaptions: s.withCaptions }),
      setClips
    ),
    handleStitchExport: makeHandleStitchExport(id, () => ({
      selectedClipIds: s.selectedClipIds,
      withCaptions: s.withCaptions,
    })),
  };
}

interface VideoHandlerOpts {
  s: ProjectState;
  lr: LocalRefs;
  clips: Clip[] | null;
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>;
  setSelectedClipId: (id: string | null) => void;
  selectedTopic: string | null;
}

function buildVideoHandlers(opts: VideoHandlerOpts) {
  const { s, lr, clips, setClips, setSelectedClipId, selectedTopic } = opts;
  const { videoRef, timelineRef, dragStateRef, previewClipIndexRef, previewClipsRef } = s;
  const { durationRef, isLoopingRef, isPreviewingRef, clipsRef, selectedClipIdRef } = lr;
  const refs = {
    videoRef,
    timelineRef,
    dragStateRef,
    durationRef,
    isLoopingRef,
    isPreviewingRef,
    clipsRef,
    selectedClipIdRef,
    previewClipIndexRef,
    previewClipsRef,
  };
  const setters = {
    setCurrentTime: s.setCurrentTime,
    setSelectedClipId,
    setIsPreviewing: s.setIsPreviewing,
    setDuration: s.setDuration,
    setClips,
  };
  const skipTo = makeSkipTo({ clipsRef, selectedClipIdRef, videoRef }, setSelectedClipId);
  return {
    togglePlay: makeTogglePlay(videoRef),
    seekToClip: makeSeekToClip(videoRef),
    skipPrev: () => skipTo("prev"),
    skipNext: () => skipTo("next"),
    handlePlayAll: makeHandlePlayAll({
      videoRef,
      clips,
      previewClipsRef,
      previewClipIndexRef,
      setIsPreviewing: s.setIsPreviewing,
      setSelectedClipId,
      selectedClipIds: s.selectedClipIds,
      selectedTopic,
    }),
    stopPreviewing: () => {
      s.setIsPreviewing(false);
      if (videoRef.current) videoRef.current.pause();
    },
    handleTimeUpdate: makeHandleTimeUpdate(refs, setters),
    handleLoadedMetadata: () => {
      if (videoRef.current) s.setDuration(videoRef.current.duration);
    },
    handleTimelineClick: makeHandleTimelineClick(timelineRef, durationRef, dragStateRef, videoRef),
    handleHandleMouseDown: makeHandleHandleMouseDown(
      { timelineRef, durationRef, dragStateRef, videoRef, clipsRef },
      setClips
    ),
    switchView: (mode: "list" | "graph") => s.setViewMode(mode),
    updateTopicLabel: (t: string, l: string) =>
      s.setTopicOverrides((prev) => ({ ...prev, [t]: l })),
  };
}

function buildResult(
  s: ProjectState,
  local: LocalState,
  handlers: ReturnType<typeof buildProjectHandlers> & ReturnType<typeof buildVideoHandlers>
): ProjectDataResult {
  return {
    ...local,
    clipCount: s.clipCount,
    setClipCount: s.setClipCount,
    clipPrompt: s.clipPrompt,
    setClipPrompt: s.setClipPrompt,
    clipTargetDuration: s.clipTargetDuration,
    setClipTargetDuration: s.setClipTargetDuration,
    selectedClipIds: s.selectedClipIds,
    setSelectedClipIds: s.setSelectedClipIds,
    withCaptions: s.withCaptions,
    setWithCaptions: s.setWithCaptions,
    videoRef: s.videoRef,
    timelineRef: s.timelineRef,
    duration: s.duration,
    setDuration: s.setDuration,
    currentTime: s.currentTime,
    setCurrentTime: s.setCurrentTime,
    isPlaying: s.isPlaying,
    setIsPlaying: s.setIsPlaying,
    isLooping: s.isLooping,
    setIsLooping: s.setIsLooping,
    showCaptions: s.showCaptions,
    setShowCaptions: s.setShowCaptions,
    isPreviewing: s.isPreviewing,
    videoUrl: s.videoUrl,
    isYouTube: s.isYouTube,
    youTubeVideoId: s.youTubeVideoId,
    transcriptOpen: s.transcriptOpen,
    setTranscriptOpen: s.setTranscriptOpen,
    downloadsOpen: s.downloadsOpen,
    setDownloadsOpen: s.setDownloadsOpen,
    viewMode: s.viewMode,
    topicOverrides: s.topicOverrides,
    setTopicOverrides: s.setTopicOverrides,
    ...handlers,
  };
}

export function useProjectData(id: string): ProjectDataResult {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact> | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [clipsStatus, setClipsStatus] = useState<string>("idle");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const s = useProjectState();

  const selectedClipIdRef = useRef<string | null>(null);
  selectedClipIdRef.current = selectedClipId;
  const durationRef = useRef(s.duration);
  durationRef.current = s.duration;
  const isLoopingRef = useRef(s.isLooping);
  isLoopingRef.current = s.isLooping;
  const isPreviewingRef = useRef(s.isPreviewing);
  isPreviewingRef.current = s.isPreviewing;
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const loadArtifacts = useLoadArtifacts(id, {
    setArtifacts,
    setVideoUrl: s.setVideoUrl,
    setIsYouTube: s.setIsYouTube,
    setYouTubeVideoId: s.setYouTubeVideoId,
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/status`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.status === "completed") loadArtifacts({ forceRefreshUrl: artifacts === null });
      }
    } finally {
      setLoading(false);
    }
  }, [id, artifacts, loadArtifacts]);

  const fetchClips = useFetchClips({
    id,
    videoRef: s.videoRef,
    setClips,
    setClipsStatus,
    selectedClipIdRef,
    setSelectedClipId,
  });

  useStatusPolling({ data, fetchStatus });
  useClipsPolling({ dataStatus: data?.status, clips, id, clipsStatus, fetchClips, setClipsStatus });
  useAutoSelectClips(clips, s.setSelectedClipIds);
  useExportPolling(clips, fetchClips);
  useArtifactRefresh(data?.status, loadArtifacts);
  const projectHandlers = buildProjectHandlers({
    id,
    setLoading,
    fetchStatus,
    setClips,
    setClipsStatus,
    setSelectedTopic,
    s,
  });
  const videoHandlers = buildVideoHandlers({
    s,
    lr: { selectedClipIdRef, durationRef, isLoopingRef, isPreviewingRef, clipsRef },
    clips,
    setClips,
    setSelectedClipId,
    selectedTopic,
  });
  const local: LocalState = {
    data,
    loading,
    artifacts,
    clips,
    clipsStatus,
    selectedTopic,
    setSelectedTopic,
    selectedClipId,
    setSelectedClipId,
  };
  return buildResult(s, local, { ...projectHandlers, ...videoHandlers });
}
