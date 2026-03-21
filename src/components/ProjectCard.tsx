"use client";

import Link from "next/link";

type ProjectStatus =
  | "pending"
  | "processing"
  | "extracting_audio"
  | "transcribing"
  | "generating_highlights"
  | "completed"
  | "failed";

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
}

interface ProjectCardProps {
  project: Project;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const PROCESSING_STATUSES: ProjectStatus[] = [
  "processing",
  "extracting_audio",
  "transcribing",
  "generating_highlights",
];

function statusBadgeClass(status: ProjectStatus): string {
  if (status === "completed") return "bg-green-500";
  if (status === "failed") return "bg-red-500";
  if (PROCESSING_STATUSES.includes(status)) return "bg-yellow-500";
  return "bg-gray-500";
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default function ProjectCard({ project, onRetry, onDelete }: ProjectCardProps) {
  const isProcessing = PROCESSING_STATUSES.includes(project.status);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p
          data-testid="project-title"
          className="text-white font-semibold truncate flex-1"
          title={project.title}
        >
          {project.title}
        </p>
        <span
          data-testid="status-badge"
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0 ${statusBadgeClass(project.status)}`}
        >
          {isProcessing && (
            <svg
              className="animate-spin w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
              <path
                strokeLinecap="round"
                d="M4 12a8 8 0 018-8"
                strokeWidth="4"
                className="opacity-75"
              />
            </svg>
          )}
          {project.status}
        </span>
      </div>

      <p
        data-testid="project-timestamp"
        className="text-gray-500 text-xs"
      >
        {formatRelativeTime(project.created_at)}
      </p>

      <div className="flex items-center gap-2 mt-auto">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="flex-1 text-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors min-h-[44px] flex items-center justify-center"
        >
          View
        </Link>
        {project.status === "failed" && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(project.id)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            Retry
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this project? This cannot be undone.")) {
                onDelete(project.id);
              }
            }}
            className="rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:border-red-900 transition-colors min-h-[44px]"
            title="Delete project"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
