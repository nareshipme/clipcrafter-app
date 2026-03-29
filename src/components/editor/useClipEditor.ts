"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { Clip } from "@/components/project/types";
import type { ClipCaption } from "./ClipVideoPlayer";

export interface ClipEditorData {
  clip: Clip;
  videoUrl: string;
  captions: ClipCaption[];
}

export interface ClipEditorState {
  data: ClipEditorData | null;
  loading: boolean;
  startSec: number;
  endSec: number;
  title: string;
  captionPosition: "top" | "center" | "bottom";
  captionSize: "sm" | "md" | "lg";
  format: "9:16" | "16:9";
  currentTime: number;
  videoDuration: number;
  exporting: boolean;
  clipStatus: Clip["status"];
  setStartSec: (v: number) => void;
  setEndSec: (v: number) => void;
  setTitle: (v: string) => void;
  setCaptionPosition: (v: "top" | "center" | "bottom") => void;
  setCaptionSize: (v: "sm" | "md" | "lg") => void;
  setFormat: (v: "9:16" | "16:9") => void;
  setCurrentTime: (v: number) => void;
  setVideoDuration: (v: number) => void;
  schedulePatch: (updates: Record<string, unknown>) => void;
  handleExport: () => Promise<void>;
  handleClipTrimmed: (id: string, ns: number, ne: number) => void;
}

// ── Sub-hooks ─────────────────────────────────────────────────────────────────

function usePatchScheduler(projectId: string, clipId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePatch = useCallback(
    (updates: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/clips/${clipId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
          if (!res.ok) throw new Error("Save failed");
        } catch {
          toast.error("Failed to save changes");
        }
      }, 500);
    },
    [projectId, clipId]
  );
  return { timerRef, schedulePatch };
}

function useExportManager(
  projectId: string,
  clipId: string,
  getExportPayload: () => Record<string, unknown>
) {
  const [exporting, setExporting] = useState(false);
  const [clipStatus, setClipStatus] = useState<Clip["status"]>("pending");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const d = (await (
          await fetch(`/api/projects/${projectId}/clips/${clipId}`)
        ).json()) as ClipEditorData;
        const s = d.clip.status;
        setClipStatus(s);
        if (s === "exported") {
          setExporting(false);
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast.success("Export ready — click Download!");
        } else if (s !== "exporting") {
          setExporting(false);
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (s === "pending") toast.error("Export failed — try again");
        }
      } catch {
        /* silent */
      }
    }, 3000);
  }, [projectId, clipId]);

  const handleExport = useCallback(async () => {
    try {
      await fetch(`/api/projects/${projectId}/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getExportPayload()),
      });
    } catch {
      /* non-blocking */
    }
    setExporting(true);
    setClipStatus("exporting");
    try {
      const res = await fetch(`/api/projects/${projectId}/clips/export-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: [clipId], withCaptions: true }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Export failed");
      }
      startPolling();
    } catch (err) {
      setExporting(false);
      setClipStatus("pending");
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }, [projectId, clipId, getExportPayload, startPolling]);

  return { exporting, clipStatus, setClipStatus, pollRef, handleExport };
}

// ── Edit fields hook ──────────────────────────────────────────────────────────

function useClipEditFields(initialStatus: Clip["status"] = "pending") {
  const [data, setData] = useState<ClipEditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [title, setTitle] = useState("");
  const [captionPosition, setCaptionPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [captionSize, setCaptionSize] = useState<"sm" | "md" | "lg">("md");
  const [format, setFormat] = useState<"9:16" | "16:9">("9:16");
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [clipStatus, setClipStatus] = useState<Clip["status"]>(initialStatus);
  return {
    data,
    setData,
    loading,
    setLoading,
    startSec,
    setStartSec,
    endSec,
    setEndSec,
    title,
    setTitle,
    captionPosition,
    setCaptionPosition,
    captionSize,
    setCaptionSize,
    format,
    setFormat,
    currentTime,
    setCurrentTime,
    videoDuration,
    setVideoDuration,
    clipStatus,
    setClipStatus,
  };
}

// ── Export payload refs (keeps stale-closure-free snapshot for export) ────────

function useExportPayloadRefs(startSec: number, endSec: number, title: string, format: string) {
  const startSecRef = useRef(startSec);
  const endSecRef = useRef(endSec);
  const titleRef = useRef(title);
  const formatRef = useRef(format);
  useEffect(() => {
    startSecRef.current = startSec;
  }, [startSec]);
  useEffect(() => {
    endSecRef.current = endSec;
  }, [endSec]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);
  const getPayload = useCallback(
    () => ({
      clip_title: titleRef.current,
      start_sec: startSecRef.current,
      end_sec: endSecRef.current,
      aspect_ratio: formatRef.current,
    }),
    []
  );
  return getPayload;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useClipEditor(projectId: string, clipId: string): ClipEditorState {
  const fields = useClipEditFields();
  const { timerRef, schedulePatch } = usePatchScheduler(projectId, clipId);
  const getExportPayload = useExportPayloadRefs(
    fields.startSec,
    fields.endSec,
    fields.title,
    fields.format
  );
  const { exporting, clipStatus, setClipStatus, pollRef, handleExport } = useExportManager(
    projectId,
    clipId,
    getExportPayload
  );

  useEffect(() => {
    fetch(`/api/projects/${projectId}/clips/${clipId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<ClipEditorData>;
      })
      .then((d) => {
        fields.setData(d);
        fields.setStartSec(d.clip.start_sec);
        fields.setEndSec(d.clip.end_sec);
        fields.setTitle(d.clip.clip_title ?? d.clip.title ?? "");
        fields.setCurrentTime(d.clip.start_sec);
        setClipStatus(d.clip.status);
        if (d.clip.aspect_ratio === "16:9") fields.setFormat("16:9");
      })
      .catch(() => toast.error("Failed to load clip"))
      .finally(() => fields.setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, clipId]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [timerRef, pollRef]
  );

  const handleClipTrimmed = useCallback(
    (id: string, ns: number, ne: number) => {
      if (id !== clipId) return;
      fields.setStartSec(ns);
      fields.setEndSec(ne);
      fields.setCurrentTime(ns);
      schedulePatch({ start_sec: ns, end_sec: ne });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipId, schedulePatch]
  );

  // Spread fields (data, loading, startSec…) then override clipStatus with export-managed one
  return { ...fields, exporting, clipStatus, schedulePatch, handleExport, handleClipTrimmed };
}
