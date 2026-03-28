"use client";

import React, { useEffect, useRef } from "react";
import { StatusData, Clip, TERMINAL_STATUSES } from "./types";

// Max time to poll before declaring a stall (10 minutes)
const STATUS_POLL_TIMEOUT_MS = 10 * 60 * 1000;
// Max time to poll clips generation before giving up (5 minutes)
const CLIPS_POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface StatusPollingArgs {
  data: StatusData | null;
  fetchStatus: () => void;
}

export function useStatusPolling({ data, fetchStatus }: StatusPollingArgs) {
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!data || TERMINAL_STATUSES.includes(data.status)) {
      pollStartRef.current = null;
      return;
    }
    // Record when we started polling this non-terminal status
    if (pollStartRef.current === null) {
      pollStartRef.current = Date.now();
    }
    const t = setInterval(() => {
      const elapsed = Date.now() - (pollStartRef.current ?? Date.now());
      if (elapsed >= STATUS_POLL_TIMEOUT_MS) {
        // Stall detected — stop polling, fetchStatus one last time to surface latest state
        clearInterval(t);
        fetchStatus();
        return;
      }
      fetchStatus();
    }, 3000);
    return () => clearInterval(t);
  }, [data, fetchStatus]);
}

interface ClipsPollingArgs {
  dataStatus: string | undefined;
  clips: Clip[] | null;
  id: string;
  clipsStatus: string;
  fetchClips: () => Promise<string | undefined>;
  setClipsStatus: React.Dispatch<React.SetStateAction<string>>;
}

export function useClipsPolling({
  dataStatus,
  clips,
  id,
  clipsStatus,
  fetchClips,
  setClipsStatus,
}: ClipsPollingArgs) {
  useEffect(() => {
    if (dataStatus !== "completed" || clips !== null || clipsStatus !== "idle") return;
    fetchClips().then(async (status) => {
      if (status === "idle" || !status) {
        await fetch(`/api/projects/${id}/clips`, { method: "POST" });
        setClipsStatus("generating");
      }
    });
  }, [dataStatus, clips, id, clipsStatus, fetchClips, setClipsStatus]);

  useEffect(() => {
    if (clipsStatus !== "generating") return;
    const startTime = Date.now();
    const t = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= CLIPS_POLL_TIMEOUT_MS) {
        // Clips generation stalled — stop spinner, surface as error
        clearInterval(t);
        setClipsStatus("error");
        return;
      }
      const status = await fetchClips();
      if (status !== "generating") clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [clipsStatus, fetchClips, setClipsStatus]);
}

export function useAutoSelectClips(
  clips: Clip[] | null,
  setSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  const initializedRef = React.useRef(false);
  useEffect(() => {
    // Only auto-select on first load — never override user's selection on subsequent polls
    if (!initializedRef.current && clips && clips.length > 0) {
      initializedRef.current = true;
      setSelectedClipIds(new Set(clips.map((c) => c.id)));
    }
  }, [clips, setSelectedClipIds]);
}
