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
  captions: ClipCaption[];
  captionStyle: "hormozi" | "modern" | "neon" | "minimal";
  setCaptionStyle: (v: "hormozi" | "modern" | "neon" | "minimal") => void;
  captionPosition: "top" | "center" | "bottom";
  captionSize: "sm" | "md" | "lg";
  format: "9:16" | "16:9";
  cropMode: "contain" | "cover" | "face" | "custom";
  cropX: number;
  cropY: number;
  cropZoom: number;
  setCropMode: (v: "contain" | "cover" | "face" | "custom") => void;
  setCropX: (v: number) => void;
  setCropY: (v: number) => void;
  setCropZoom: (v: number) => void;
  currentTime: number;
  videoDuration: number;
  exporting: boolean;
  clipStatus: Clip["status"];
  setStartSec: (v: number) => void;
  setEndSec: (v: number) => void;
  setTitle: (v: string) => void;
  setCaptions: (v: ClipCaption[]) => void;
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
      const exportPayload = getExportPayload();
      const res = await fetch(`/api/projects/${projectId}/clips/export-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipIds: [clipId],
          withCaptions: true,
          captions: exportPayload.captions,
          captionStyle: exportPayload.caption_style,
          captionPosition: exportPayload.caption_position,
          captionSize: exportPayload.caption_size,
          cropMode: exportPayload.crop_mode,
          cropX: exportPayload.crop_x,
          cropY: exportPayload.crop_y,
          cropZoom: exportPayload.crop_zoom,
        }),
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

// ── Stable ref tracker (keeps refs in sync with state values) ─────────────────

function useStableRefs(startSec: number, endSec: number, title: string, format: "9:16" | "16:9") {
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
  return { startSecRef, endSecRef, titleRef, formatRef };
}

// ── Data loader ────────────────────────────────────────────────────────────────

function useClipLoader(
  projectId: string,
  clipId: string,
  setters: {
    setData: (d: ClipEditorData) => void;
    setStartSec: (v: number) => void;
    setEndSec: (v: number) => void;
    setTitle: (v: string) => void;
    setCurrentTime: (v: number) => void;
    setFormat: (v: "9:16" | "16:9") => void;
    setCaptionStyle: (v: "hormozi" | "modern" | "neon" | "minimal") => void;
    setClipStatus: (v: Clip["status"]) => void;
    setCaptions: (v: ClipCaption[]) => void;
    setVideoDuration: (v: number) => void;
    setLoading: (v: boolean) => void;
  }
) {
  const {
    setData,
    setStartSec,
    setEndSec,
    setTitle,
    setCurrentTime,
    setFormat,
    setCaptionStyle,
    setClipStatus,
    setCaptions,
    setVideoDuration,
    setLoading,
  } = setters;
  useEffect(() => {
    fetch(`/api/projects/${projectId}/clips/${clipId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<ClipEditorData>;
      })
      .then((d) => {
        setData(d);
        setStartSec(d.clip.start_sec);
        setEndSec(d.clip.end_sec);
        setTitle(d.clip.clip_title ?? d.clip.title ?? "");
        setCurrentTime(d.clip.start_sec);
        setClipStatus(d.clip.status);
        setCaptions(d.captions);
        // Use clip end_sec as the video duration fallback (Remotion Player manages its own playback)
        setVideoDuration(d.clip.end_sec);
        if ((d.clip as Clip & { aspect_ratio?: string }).aspect_ratio === "16:9") setFormat("16:9");
        const style = (d.clip as Clip & { caption_style?: string }).caption_style;
        if (style && ["hormozi", "modern", "neon", "minimal"].includes(style))
          setCaptionStyle(style as "hormozi" | "modern" | "neon" | "minimal");
      })
      .catch(() => toast.error("Failed to load clip"))
      .finally(() => setLoading(false));
  }, [
    projectId,
    clipId,
    setData,
    setStartSec,
    setEndSec,
    setTitle,
    setCurrentTime,
    setFormat,
    setCaptionStyle,
    setClipStatus,
    setCaptions,
    setVideoDuration,
    setLoading,
  ]);
}

// ── Main hook ─────────────────────────────────────────────────────────────────

function useEditorStyleState() {
  const [captionStyle, setCaptionStyle] = useState<"hormozi" | "modern" | "neon" | "minimal">(
    "hormozi"
  );
  const [captionPosition, setCaptionPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [captionSize, setCaptionSize] = useState<"sm" | "md" | "lg">("md");
  const [format, setFormat] = useState<"9:16" | "16:9">("9:16");
  const [cropMode, setCropMode] = useState<"contain" | "cover" | "face" | "custom">("cover");
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  return {
    captionStyle,
    setCaptionStyle,
    captionPosition,
    setCaptionPosition,
    captionSize,
    setCaptionSize,
    format,
    setFormat,
    cropMode,
    setCropMode,
    cropX,
    setCropX,
    cropY,
    setCropY,
    cropZoom,
    setCropZoom,
    currentTime,
    setCurrentTime,
    videoDuration,
    setVideoDuration,
  };
}

// eslint-disable-next-line max-lines-per-function
export function useClipEditor(projectId: string, clipId: string): ClipEditorState {
  const [data, setData] = useState<ClipEditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [title, setTitle] = useState("");
  const [captions, setCaptions] = useState<ClipCaption[]>([]);
  const style = useEditorStyleState();
  const { timerRef, schedulePatch } = usePatchScheduler(projectId, clipId);
  const { startSecRef, endSecRef, titleRef, formatRef } = useStableRefs(
    startSec,
    endSec,
    title,
    style.format
  );
  const captionsRef = useRef<ClipCaption[]>([]);
  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);
  const getExportPayload = useCallback(
    () => ({
      clip_title: titleRef.current,
      start_sec: startSecRef.current,
      end_sec: endSecRef.current,
      aspect_ratio: formatRef.current,
      captions: captionsRef.current,
      // Editor style settings — saved to DB so re-exports use same config
      caption_style: style.captionStyle,
      caption_position: style.captionPosition,
      caption_size: style.captionSize,
      crop_mode: style.cropMode,
      crop_x: style.cropX,
      crop_y: style.cropY,
      crop_zoom: style.cropZoom,
    }),
    [titleRef, startSecRef, endSecRef, formatRef, style]
  );
  const { exporting, clipStatus, setClipStatus, pollRef, handleExport } = useExportManager(
    projectId,
    clipId,
    getExportPayload
  );
  useClipLoader(projectId, clipId, {
    setData,
    setStartSec,
    setEndSec,
    setTitle,
    setCurrentTime: style.setCurrentTime,
    setFormat: style.setFormat,
    setCaptionStyle: style.setCaptionStyle,
    setClipStatus,
    setCaptions,
    setVideoDuration: style.setVideoDuration,
    setLoading,
  });
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
      setStartSec(ns);
      setEndSec(ne);
      style.setCurrentTime(ns);
      schedulePatch({ start_sec: ns, end_sec: ne });
    },
    [clipId, schedulePatch, style]
  );
  return {
    data,
    loading,
    startSec,
    endSec,
    title,
    captions,
    captionStyle: style.captionStyle,
    setCaptionStyle: style.setCaptionStyle,
    captionPosition: style.captionPosition,
    captionSize: style.captionSize,
    format: style.format,
    currentTime: style.currentTime,
    videoDuration: style.videoDuration,
    exporting,
    clipStatus,
    setStartSec,
    setEndSec,
    setTitle,
    setCaptions,
    setCaptionPosition: style.setCaptionPosition,
    setCaptionSize: style.setCaptionSize,
    setFormat: style.setFormat,
    cropMode: style.cropMode,
    cropX: style.cropX,
    cropY: style.cropY,
    cropZoom: style.cropZoom,
    setCropMode: style.setCropMode,
    setCropX: style.setCropX,
    setCropY: style.setCropY,
    setCropZoom: style.setCropZoom,
    setCurrentTime: style.setCurrentTime,
    setVideoDuration: style.setVideoDuration,
    schedulePatch,
    handleExport,
    handleClipTrimmed,
  };
}
