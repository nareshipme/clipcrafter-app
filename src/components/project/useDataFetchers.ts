"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Artifact, Clip } from "./types";

interface ArtifactSetters {
  setArtifacts: React.Dispatch<React.SetStateAction<Record<string, Artifact> | null>>;
  setVideoUrl: (url: string) => void;
  setIsYouTube: (v: boolean) => void;
  setYouTubeVideoId: (id: string) => void;
}

export function useLoadArtifacts(id: string, setters: ArtifactSetters) {
  const { setArtifacts, setVideoUrl, setIsYouTube, setYouTubeVideoId } = setters;
  return useCallback(
    (_artifacts: Record<string, Artifact> | null) => {
      // Always fetch fresh — presigned URLs expire after 7h and must be refreshed
      fetch(`/api/projects/${id}/artifacts`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setArtifacts(d.artifacts);
          if (d.artifacts?.video?.available && d.artifacts.video.url) {
            const url = d.artifacts.video.url;
            setVideoUrl(url);
            const ytMatch = url.match(
              /(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([^?&/#]+)/
            );
            if (ytMatch) {
              setIsYouTube(true);
              setYouTubeVideoId(ytMatch[1]);
            }
          }
        })
        .catch(() => toast.error("Failed to load video — please refresh"));
    },
    [id, setArtifacts, setVideoUrl, setIsYouTube, setYouTubeVideoId]
  );
}

interface ClipFetcherArgs {
  id: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>;
  setClipsStatus: React.Dispatch<React.SetStateAction<string>>;
  selectedClipIdRef: React.RefObject<string | null>;
  setSelectedClipId: (id: string | null) => void;
}

export function buildClipFetcher(args: ClipFetcherArgs) {
  const { id, videoRef, setClips, setClipsStatus, selectedClipIdRef, setSelectedClipId } = args;
  return async function fetchClips() {
    const r = await fetch(`/api/projects/${id}/clips`);
    if (!r.ok) return;
    const d = await r.json();
    const status = d.clips_status ?? "idle";
    setClipsStatus(status);
    if (d.clips && d.clips.length > 0) {
      const sorted = [...d.clips].sort((a: Clip, b: Clip) => b.score - a.score);
      setClips(sorted);
      if (!selectedClipIdRef.current) {
        setSelectedClipId(sorted[0].id);
        if (videoRef.current) videoRef.current.currentTime = sorted[0].start_sec;
      }
    }
    return status;
  };
}

/** Refresh presigned artifact URLs every 6 hours while the page is open (they expire at 7h). */
export function useArtifactRefresh(
  status: string | undefined,
  loadArtifacts: (artifacts: Record<string, Artifact> | null) => void
) {
  useEffect(() => {
    if (status !== "completed") return;
    const interval = setInterval(() => loadArtifacts(null), 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [status, loadArtifacts]);
}
