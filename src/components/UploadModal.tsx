"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "upload" | "youtube";

type UploadStep = "idle" | "creating" | "uploading" | "processing" | "done" | "error";

const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  creating: "Creating project...",
  uploading: "Uploading to R2...",
  processing: "Starting processing...",
  done: "Done!",
  error: "Something went wrong.",
};

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url.trim());
}

function _isYouTubeLive(url: string): boolean {
  return /youtube\.com\/live\//i.test(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Submit helpers ───────────────────────────────────────────────────────────

interface SubmitContext {
  setStep: (s: UploadStep) => void;
  setErrorMsg: (m: string) => void;
  router: ReturnType<typeof useRouter>;
}

async function submitUploadFile(file: File, ctx: SubmitContext): Promise<void> {
  ctx.setStep("creating");
  ctx.setErrorMsg("");
  try {
    const createRes = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name, type: "upload" }),
    });
    if (!createRes.ok) throw new Error("Failed to create project");
    const { id } = await createRes.json();

    ctx.setStep("uploading");
    // Send file directly to our API — server uploads to R2 (no CORS issues)
    const formData = new FormData();
    formData.append("file", file);
    const uploadRes = await fetch(`/api/projects/${id}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      throw new Error(`Upload failed: ${uploadRes.status} ${body}`);
    }

    ctx.setStep("processing");
    const processRes = await fetch(`/api/projects/${id}/process`, { method: "POST" });
    if (!processRes.ok) throw new Error("Failed to start processing");

    ctx.setStep("done");
    ctx.router.push(`/dashboard/projects/${id}`);
  } catch (err) {
    console.error("[UploadModal] upload failed:", err);
    ctx.setStep("error");
    ctx.setErrorMsg(err instanceof Error ? err.message : "Unknown error");
  }
}

async function submitYoutubeUrl(youtubeUrl: string, ctx: SubmitContext): Promise<void> {
  ctx.setStep("creating");
  ctx.setErrorMsg("");
  try {
    const url = youtubeUrl.trim();
    const ytMatch = url.match(/(?:v=|youtu\.be\/|\/live\/)([a-zA-Z0-9_-]{11})/);
    const title = ytMatch ? `YouTube video (${ytMatch[1]})` : url;
    const createRes = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type: "youtube", youtubeUrl: url }),
    });
    if (!createRes.ok) throw new Error("Failed to create project");
    const { id } = await createRes.json();

    ctx.setStep("processing");
    const processRes = await fetch(`/api/projects/${id}/process`, { method: "POST" });
    if (!processRes.ok) throw new Error("Failed to start processing");

    ctx.setStep("done");
    ctx.router.push(`/dashboard/projects/${id}`);
  } catch (err) {
    ctx.setStep("error");
    ctx.setErrorMsg(err instanceof Error ? err.message : "Unknown error");
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UploadModalState {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  file: File | null;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  youtubeError: string;
  setYoutubeError: (v: string) => void;
  step: UploadStep;
  errorMsg: string;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  handleClose: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleUploadSubmit: () => Promise<void>;
  handleYoutubeSubmit: () => Promise<void>;
}

function useUploadModal(onClose: () => void): UploadModalState {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [step, setStep] = useState<UploadStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = step === "creating" || step === "uploading" || step === "processing";

  function handleClose() {
    if (step === "creating" || step === "uploading" || step === "processing") return;
    setActiveTab("upload");
    setFile(null);
    setYoutubeUrl("");
    setYoutubeError("");
    setStep("idle");
    setErrorMsg("");
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith("video/")) setFile(dropped);
  }

  async function handleUploadSubmit() {
    if (!file) return;
    await submitUploadFile(file, { setStep, setErrorMsg, router });
  }

  async function handleYoutubeSubmit() {
    setYoutubeError("");
    if (!isYouTubeUrl(youtubeUrl)) {
      setYoutubeError("Please enter a valid YouTube URL");
      return;
    }
    await submitYoutubeUrl(youtubeUrl, { setStep, setErrorMsg, router });
  }

  return {
    activeTab,
    setActiveTab,
    file,
    youtubeUrl,
    setYoutubeUrl,
    youtubeError,
    setYoutubeError,
    step,
    errorMsg,
    isDragging,
    setIsDragging,
    fileInputRef,
    isBusy,
    handleClose,
    handleFileChange,
    handleDrop,
    handleUploadSubmit,
    handleYoutubeSubmit,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileDropContents({ file }: { file: File | null }) {
  if (file) {
    return (
      <div className="flex flex-col items-center gap-1">
        <svg
          className="w-8 h-8 text-violet-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
          />
        </svg>
        <p className="text-white font-medium text-sm">{file.name}</p>
        <p className="text-gray-400 text-xs">{formatBytes(file.size)}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        className="w-10 h-10 text-gray-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p className="text-gray-400 text-sm">Drag &amp; drop or click to select</p>
      <p className="text-gray-600 text-xs">video/*</p>
    </div>
  );
}

function ModalTabBar({
  activeTab,
  onSetActiveTab,
}: {
  activeTab: Tab;
  onSetActiveTab: (t: Tab) => void;
}) {
  return (
    <div className="flex rounded-lg bg-gray-800 p-1 gap-1">
      <button
        role="tab"
        aria-selected={activeTab === "upload"}
        onClick={() => onSetActiveTab("upload")}
        className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${activeTab === "upload" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}
      >
        Upload File
      </button>
      <button
        role="tab"
        aria-selected={activeTab === "youtube"}
        onClick={() => onSetActiveTab("youtube")}
        className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${activeTab === "youtube" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"}`}
      >
        YouTube URL
      </button>
    </div>
  );
}

interface UploadFileTabProps {
  file: File | null;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  step: UploadStep;
  errorMsg: string;
  isBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onSubmit: () => void;
}

function UploadFileTab({
  file,
  isDragging,
  setIsDragging,
  step,
  errorMsg,
  isBusy,
  fileInputRef,
  onFileChange,
  onDrop,
  onSubmit,
}: UploadFileTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div
        onClick={() => !isBusy && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-gray-700 hover:border-gray-500"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onFileChange}
        />
        <FileDropContents file={file} />
      </div>
      {step !== "idle" && (
        <p
          className={`text-sm text-center ${step === "error" ? "text-red-400" : "text-violet-400"}`}
        >
          {step === "error" ? errorMsg : STEP_LABELS[step]}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!file || isBusy}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isBusy ? STEP_LABELS[step] : "Upload & Process"}
      </button>
    </div>
  );
}

interface YoutubeTabProps {
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  youtubeError: string;
  setYoutubeError: (v: string) => void;
  step: UploadStep;
  errorMsg: string;
  isBusy: boolean;
  onSubmit: () => void;
}

function YoutubeTab({
  youtubeUrl,
  setYoutubeUrl,
  youtubeError,
  setYoutubeError,
  step,
  errorMsg,
  isBusy,
  onSubmit,
}: YoutubeTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300 font-medium" htmlFor="youtube-url">
          YouTube URL
        </label>
        <input
          id="youtube-url"
          type="url"
          value={youtubeUrl}
          onChange={(e) => {
            setYoutubeUrl(e.target.value);
            setYoutubeError("");
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={isBusy}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500 disabled:opacity-50 min-h-[44px]"
        />
        {youtubeError && <p className="text-red-400 text-xs">{youtubeError}</p>}
      </div>
      {step !== "idle" && step !== "error" && (
        <p className="text-sm text-center text-violet-400">{STEP_LABELS[step]}</p>
      )}
      {step === "error" && <p className="text-sm text-center text-red-400">{errorMsg}</p>}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!youtubeUrl.trim() || isBusy}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isBusy ? STEP_LABELS[step] : "Process Video"}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UploadModal({ open, onClose }: UploadModalProps) {
  const state = useUploadModal(onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4"
      onClick={(e) => e.target === e.currentTarget && state.handleClose()}
    >
      <div className="w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-800 p-5 sm:p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">New Project</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={state.handleClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" fill="none">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <ModalTabBar activeTab={state.activeTab} onSetActiveTab={state.setActiveTab} />

        {state.activeTab === "upload" && (
          <UploadFileTab
            file={state.file}
            isDragging={state.isDragging}
            setIsDragging={state.setIsDragging}
            step={state.step}
            errorMsg={state.errorMsg}
            isBusy={state.isBusy}
            fileInputRef={state.fileInputRef}
            onFileChange={state.handleFileChange}
            onDrop={state.handleDrop}
            onSubmit={state.handleUploadSubmit}
          />
        )}

        {state.activeTab === "youtube" && (
          <YoutubeTab
            youtubeUrl={state.youtubeUrl}
            setYoutubeUrl={state.setYoutubeUrl}
            youtubeError={state.youtubeError}
            setYoutubeError={state.setYoutubeError}
            step={state.step}
            errorMsg={state.errorMsg}
            isBusy={state.isBusy}
            onSubmit={state.handleYoutubeSubmit}
          />
        )}
      </div>
    </div>
  );
}
