"use client";

import { useEffect, useState } from "react";

type AdminProject = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  user_email: string;
  r2_key: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  processing: "bg-yellow-900 text-yellow-300",
  completed: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
};
const TH_CLS = "text-left px-4 py-3 text-gray-500 text-xs uppercase tracking-wide font-medium";
const HEADERS = ["Title", "User", "Status", "Created", "Actions"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type RowProps = {
  project: AdminProject;
  deleting: boolean;
  onDelete: (id: string, title: string) => void;
};

function ProjectRow({ project, deleting, onDelete }: RowProps) {
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40">
      <td className="px-4 py-3 text-white max-w-xs truncate">{project.title}</td>
      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{project.user_email}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] ?? "bg-gray-700 text-gray-300"}`}
        >
          {project.status}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(project.created_at)}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={deleting}
          onClick={() => onDelete(project.id, project.title)}
          className="px-2 py-1 text-xs rounded bg-red-900/40 border border-red-800 text-red-400 hover:bg-red-900/70 transition-colors disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Force Delete"}
        </button>
      </td>
    </tr>
  );
}

type TableProps = {
  projects: AdminProject[];
  loading: boolean;
  deleting: string | null;
  onDelete: (id: string, title: string) => void;
};

function ProjectsTable({ projects, loading, deleting, onDelete }: TableProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {HEADERS.map((h) => (
              <th key={h} className={TH_CLS}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                Loading…
              </td>
            </tr>
          ) : projects.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No projects found
              </td>
            </tr>
          ) : (
            projects.map((p) => (
              <ProjectRow key={p.id} project={p} deleting={deleting === p.id} onDelete={onDelete} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type PgProps = { page: number; totalPages: number; onPage: (p: number) => void };

function PaginationBar({ page, totalPages, onPage }: PgProps) {
  if (totalPages <= 1) return null;
  const cls =
    "px-3 py-1.5 text-sm rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 disabled:opacity-40 transition-colors";
  return (
    <div className="flex items-center gap-3 justify-end">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cls}>
        ← Prev
      </button>
      <span className="text-sm text-gray-400">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className={cls}
      >
        Next →
      </button>
    </div>
  );
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    async function load() {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (statusFilter) p.set("status", statusFilter);
      const res = await fetch(`/api/admin/projects?${p}`);
      const d = (await res.json()) as { projects: AdminProject[]; total: number };
      setProjects(d.projects ?? []);
      setTotal(d.total ?? 0);
      setLoading(false);
    }
    void load();
  }, [page, statusFilter, tick]);

  async function handleForceDelete(id: string, title: string) {
    if (!confirm(`Force delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
    setDeleting(null);
    setTick((t) => t + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Projects ({total})</h1>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">All statuses</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <ProjectsTable
        projects={projects}
        loading={loading}
        deleting={deleting}
        onDelete={(id, title) => void handleForceDelete(id, title)}
      />
      <PaginationBar page={page} totalPages={Math.max(1, Math.ceil(total / 50))} onPage={setPage} />
    </div>
  );
}
