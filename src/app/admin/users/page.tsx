"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  daily_usage_seconds: number;
  alpha_expires_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  project_count: number;
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1800,
  starter: 18000,
  pro: 72000,
  unlimited: Infinity,
  trial: Infinity,
};
const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-900 text-blue-300",
  pro: "bg-violet-900 text-violet-300",
  unlimited: "bg-yellow-900 text-yellow-300",
  trial: "bg-green-900 text-green-300",
};
const TH_CLS = "text-left px-4 py-3 text-gray-500 text-xs uppercase tracking-wide font-medium";
const HEADERS = ["Email", "Name", "Plan", "Usage today", "Alpha expires", "Actions"];

function fmt(s: number): string {
  if (!isFinite(s)) return "∞";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatUsage(secs: number, plan: string): string {
  return `${fmt(secs)} / ${fmt(PLAN_LIMITS[plan] ?? PLAN_LIMITS.free)}`;
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type RowProps = {
  user: AdminUser;
  disabled: boolean;
  onSetPlan: (id: string, p: string) => void;
  onResetUsage: (id: string) => void;
  onGrantAlpha: (id: string) => void;
};

function UserRow({ user, disabled, onSetPlan, onResetUsage, onGrantAlpha }: RowProps) {
  const btnCls =
    "px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-50";
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40">
      <td className="px-4 py-3 font-mono text-xs">
        <Link href={`/admin/users/${user.id}`} className="text-violet-400 hover:text-violet-300 hover:underline">
          {user.email}
        </Link>
      </td>
      <td className="px-4 py-3 text-gray-300">{user.full_name ?? "—"}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[user.plan] ?? PLAN_COLORS.free}`}
        >
          {user.plan}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-300 font-mono text-xs">
        {formatUsage(user.daily_usage_seconds, user.plan)}
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(user.alpha_expires_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            disabled={disabled}
            value={user.plan}
            onChange={(e) => onSetPlan(user.id, e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
          >
            <option value="free">free</option>
            <option value="starter">starter</option>
            <option value="pro">pro</option>
            <option value="unlimited">unlimited</option>
          </select>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResetUsage(user.id)}
            className={btnCls}
          >
            Reset Usage
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onGrantAlpha(user.id)}
            className={btnCls}
          >
            Grant Alpha (30d)
          </button>
        </div>
      </td>
    </tr>
  );
}

type TableProps = {
  users: AdminUser[];
  loading: boolean;
  actingId: string | null;
  onSetPlan: (id: string, p: string) => void;
  onResetUsage: (id: string) => void;
  onGrantAlpha: (id: string) => void;
};

function UsersTable({
  users,
  loading,
  actingId,
  onSetPlan,
  onResetUsage,
  onGrantAlpha,
}: TableProps) {
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
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                Loading…
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                No users found
              </td>
            </tr>
          ) : (
            users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                disabled={actingId === u.id}
                onSetPlan={onSetPlan}
                onResetUsage={onResetUsage}
                onGrantAlpha={onGrantAlpha}
              />
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    async function load() {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) p.set("search", search);
      const res = await fetch(`/api/admin/users?${p}`);
      const d = (await res.json()) as { users: AdminUser[]; total: number };
      setUsers(d.users ?? []);
      setTotal(d.total ?? 0);
      setLoading(false);
    }
    void load();
  }, [page, search, tick]);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setActionLoading(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActionLoading(null);
    setTick((t) => t + 1);
  }

  function handleSetPlan(id: string, plan: string) {
    void patchUser(id, { plan });
  }
  function handleResetUsage(id: string) {
    void patchUser(id, { daily_usage_seconds: 0 });
  }
  function handleGrantAlpha(id: string) {
    void patchUser(id, {
      alpha_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Users ({total})</h1>
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 w-64"
        />
      </div>
      <UsersTable
        users={users}
        loading={loading}
        actingId={actionLoading}
        onSetPlan={handleSetPlan}
        onResetUsage={handleResetUsage}
        onGrantAlpha={handleGrantAlpha}
      />
      <PaginationBar page={page} totalPages={Math.max(1, Math.ceil(total / 50))} onPage={setPage} />
    </div>
  );
}
