"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { ProjectContextProvider, useProjectContext } from "@/components/project/ProjectContext";

// ---- Inline editable title ----

const EDIT_PENCIL_PATH =
  "M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z";

function InlineTitleInput({
  editValue,
  inputRef,
  onChange,
  onBlur,
  onKeyDown,
}: {
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="text-xs text-white bg-gray-800 border border-violet-500 rounded px-2 py-0.5 w-48 focus:outline-none"
    />
  );
}

function InlineTitle({
  projectId,
  title,
  onSave,
}: {
  projectId: string;
  title: string;
  onSave: (newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditValue(title);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        onSave(trimmed);
      } else {
        toast.error("Failed to update project name");
      }
    } catch {
      toast.error("Network error — could not save title");
    }
    setEditing(false);
  }

  const displayTitle = title.length > 30 ? title.slice(0, 30) + "…" : title;

  if (editing) {
    return (
      <InlineTitleInput
        editValue={editValue}
        inputRef={inputRef}
        onChange={setEditValue}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex items-center gap-1 text-left min-w-0"
    >
      <span className="text-gray-300 hover:text-white truncate transition-colors">
        {displayTitle}
      </span>
      <svg
        className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={EDIT_PENCIL_PATH} />
      </svg>
    </button>
  );
}

// ---- Status badge ----

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-green-500";
  if (status === "failed") return "bg-red-500";
  if (["processing", "extracting_audio", "transcribing", "generating_highlights"].includes(status))
    return "bg-yellow-500";
  return "bg-gray-500";
}

// ---- Top bar ----

function TopBar({
  title,
  onSaveTitle,
  projectId,
  status,
}: {
  title: string;
  onSaveTitle: (t: string) => void;
  projectId: string;
  status?: string;
}) {
  return (
    <header className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-gray-800 shrink-0">
      <Link
        href="/dashboard"
        aria-label="Back"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm min-h-[44px] py-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back
      </Link>
      <div className="flex-1 min-w-0">
        <InlineTitle projectId={projectId} title={title} onSave={onSaveTitle} />
      </div>
      {status && (
        <span
          data-testid="status-badge"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white shrink-0 ${statusBadgeClass(status)}`}
        >
          {status}
        </span>
      )}
    </header>
  );
}

// ---- Mini-player strip (visible on non-Studio zones when video has loaded) ----

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function MiniPlayerStrip() {
  const { currentTime, duration, isPlaying, togglePlay, videoRef } = useProjectContext();
  const pathname = usePathname();
  const isStudio = pathname.endsWith("/studio");

  if (isStudio || duration === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900 shrink-0">
      <svg
        className="w-4 h-4 text-gray-400 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <span className="text-xs text-gray-400 font-mono shrink-0 w-10">
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={(e) => {
          const t = Number(e.target.value);
          if (videoRef.current) videoRef.current.currentTime = t;
        }}
        className="flex-1 h-1 accent-violet-500 cursor-pointer"
        aria-label="Seek"
      />
      <span className="text-xs text-gray-500 font-mono shrink-0 w-10">{formatTime(duration)}</span>
      <button
        type="button"
        onClick={togglePlay}
        className="text-gray-400 hover:text-white transition-colors p-1 shrink-0"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7-11-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ---- Navigation tabs ----

const NAV_TABS = [
  {
    label: "Clips",
    href: "studio",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
        />
      </svg>
    ),
  },
  {
    label: "Transcript",
    href: "insights",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    label: "Exports",
    href: "outputs",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "settings",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

function BottomNav({ id }: { id: string }) {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex border-t border-gray-800 bg-gray-950 z-10">
      {NAV_TABS.map((tab) => {
        const href = `/dashboard/projects/${id}/${tab.href}`;
        const active = pathname.includes(`/${tab.href}`);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              active ? "text-violet-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function DesktopNav({ id }: { id: string }) {
  const pathname = usePathname();
  return (
    <nav className="hidden lg:flex flex-col w-44 shrink-0 border-r border-gray-800 py-4 gap-1">
      {NAV_TABS.map((tab) => {
        const href = `/dashboard/projects/${id}/${tab.href}`;
        const active = pathname.includes(`/${tab.href}`);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg mx-2 text-sm font-medium transition-colors ${
              active
                ? "bg-violet-900/50 text-violet-300"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---- Layout shell (inside context provider) ----

function LayoutShell({ id, children }: { id: string; children: React.ReactNode }) {
  const { data } = useProjectContext();
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const title = titleOverride ?? data?.title ?? "";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <TopBar title={title} onSaveTitle={setTitleOverride} projectId={id} status={data?.status} />
      <MiniPlayerStrip />
      <div className="flex flex-1 min-h-0">
        <DesktopNav id={id} />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 min-w-0">{children}</main>
      </div>
      <BottomNav id={id} />
    </div>
  );
}

// ---- Entry point ----

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({ children, params }: Props) {
  const { id } = use(params);
  return (
    <ProjectContextProvider id={id}>
      <LayoutShell id={id}>{children}</LayoutShell>
    </ProjectContextProvider>
  );
}
