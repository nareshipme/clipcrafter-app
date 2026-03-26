"use client";

import { toast } from "sonner";
import { Clip } from "./types";

interface ClipStateSetters {
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>;
  setClipsStatus: React.Dispatch<React.SetStateAction<string>>;
  setSelectedTopic: (t: string | null) => void;
}

interface ProjectStateSetters {
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  fetchStatus: () => void;
}

export function makeHandleRetry(id: string, { setLoading, fetchStatus }: ProjectStateSetters) {
  return async function handleRetry() {
    const toastId = toast.loading("Retrying processing…");
    try {
      const res = await fetch(`/api/projects/${id}/process`, { method: "POST" });
      if (res.ok) {
        toast.success("Processing restarted", { id: toastId });
        setLoading(true);
        fetchStatus();
      } else {
        toast.error("Failed to retry — please try again", { id: toastId });
      }
    } catch {
      toast.error("Network error — please try again", { id: toastId });
    }
  };
}

export function makeHandleDelete(id: string) {
  return async function handleDelete() {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const toastId = toast.loading("Deleting project…");
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted", { id: toastId });
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1000);
      } else {
        toast.error("Failed to delete project", { id: toastId });
      }
    } catch {
      toast.error("Network error — please try again", { id: toastId });
    }
  };
}

interface GenerateClipsArgs {
  clipCount: number | "auto";
  clipPrompt: string;
  clipTargetDuration: string;
}

export function makeHandleGenerateClips(
  id: string,
  getArgs: () => GenerateClipsArgs,
  { setClips, setClipsStatus, setSelectedTopic }: ClipStateSetters
) {
  return async function handleGenerateClips() {
    const toastId = toast.loading("Generating clips…");
    try {
      const { clipCount, clipPrompt, clipTargetDuration } = getArgs();
      const body: Record<string, unknown> = clipCount === "auto" ? {} : { count: clipCount };
      if (clipPrompt.trim()) body.prompt = clipPrompt.trim();
      if (clipTargetDuration && Number(clipTargetDuration) > 0)
        body.targetDuration = Number(clipTargetDuration);
      setClips(null);
      setSelectedTopic(null);
      const res = await fetch(`/api/projects/${id}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Clip generation started", { id: toastId });
        setClipsStatus("generating");
      } else {
        toast.error("Failed to start clip generation", { id: toastId });
      }
    } catch {
      toast.error("Network error — please try again", { id: toastId });
    }
  };
}

export function makeHandleClipAction(
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>
) {
  return async function handleClipAction(
    clipId: string,
    update: Partial<
      Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">
    >
  ) {
    const res = await fetch(`/api/clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (res.ok) {
      const json = await res.json();
      setClips((prev) => prev?.map((c) => (c.id === clipId ? { ...c, ...json.clip } : c)) ?? null);
      if (update.status === "approved") toast.success("Clip kept ✓");
      else if (update.status === "rejected") toast("Clip skipped");
    } else {
      toast.error("Failed to update clip");
    }
  };
}

export function makeHandleExportClip(
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>
) {
  return async function handleExportClip(clipId: string) {
    const toastId = toast.loading("Queuing export…");
    try {
      const res = await fetch(`/api/clips/${clipId}/export`, { method: "POST" });
      if (res.ok) {
        toast.success("Export started — we'll update when it's ready", { id: toastId });
        setClips(
          (prev) => prev?.map((c) => (c.id === clipId ? { ...c, status: "exporting" } : c)) ?? null
        );
      } else {
        toast.error("Failed to start export", { id: toastId });
      }
    } catch {
      toast.error("Network error — please try again", { id: toastId });
    }
  };
}

interface StitchExportArgs {
  selectedClipIds: Set<string>;
  withCaptions: boolean;
}

export function makeHandleStitchExport(id: string, getArgs: () => StitchExportArgs) {
  return async function handleStitchExport() {
    const { selectedClipIds, withCaptions } = getArgs();
    const clipIds = [...selectedClipIds];
    if (clipIds.length < 2) {
      toast.warning("Select at least 2 clips to stitch");
      return;
    }
    const toastId = toast.loading(`Stitching ${clipIds.length} clips…`);
    try {
      const res = await fetch(`/api/projects/${id}/clips/stitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds, withCaptions }),
      });
      if (res.ok) {
        toast.success(`Stitching ${clipIds.length} clips — we'll notify you when ready`, {
          id: toastId,
        });
      } else {
        toast.error("Failed to start stitch", { id: toastId });
      }
    } catch {
      toast.error("Network error — please try again", { id: toastId });
    }
  };
}

interface ExportBatchArgs {
  selectedClipIds: Set<string>;
  withCaptions: boolean;
}

export function makeHandleExportBatch(
  id: string,
  getArgs: () => ExportBatchArgs,
  setClips: React.Dispatch<React.SetStateAction<Clip[] | null>>
) {
  return async function handleExportBatch() {
    const { selectedClipIds, withCaptions } = getArgs();
    const clipIds = [...selectedClipIds];
    if (clipIds.length === 0) {
      toast.warning("Select at least one clip to export");
      return;
    }
    const toastId = toast.loading(
      `Queuing ${clipIds.length} clip${clipIds.length > 1 ? "s" : ""} for export…`
    );
    try {
      const res = await fetch(`/api/projects/${id}/clips/export-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds, withCaptions }),
      });
      if (res.ok) {
        toast.success(`${clipIds.length} clip${clipIds.length > 1 ? "s" : ""} queued for export`, {
          id: toastId,
        });
        setClips(
          (prev) =>
            prev?.map((c) => (selectedClipIds.has(c.id) ? { ...c, status: "exporting" } : c)) ??
            null
        );
      } else {
        toast.error("Failed to queue exports", { id: toastId });
      }
    } catch {
      toast.error("Network error — please try again", { id: toastId });
    }
  };
}
