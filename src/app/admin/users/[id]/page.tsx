"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-900 text-blue-300",
  pro: "bg-violet-900 text-violet-300",
  unlimited: "bg-yellow-900 text-yellow-300",
  trial: "bg-green-900 text-green-300",
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1800,
  starter: 18000,
  pro: 72000,
  unlimited: Infinity,
  trial: Infinity,
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
  processing: "bg-yellow-900 text-yellow-300",
  generating_highlights: "bg-yellow-900 text-yellow-300",
  transcribing: "bg-yellow-900 text-yellow-300",
  extracting_audio: "bg-yellow-900 text-yellow-300",
  pending: "bg-gray-700 text-gray-400",
  uploading: "bg-blue-900 text-blue-300",
};

export type UserDetail = {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string | null;
  plan: string;
  daily_usage_seconds: number;
  trial_ends_at: string | null;
  alpha_expires_at: string | null;
  razorpay_subscription_id: string | null;
  created_at: string;
};

export type Stats = {
  totalUsageSeconds: number;
  thisMonthUsageSeconds: number;
  totalProjects: number;
  thisMonthProjects: number;
  totalExports: number;
};

export type DailyUsage = { date: string; seconds: number };

export type RecentProject = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  clip_count: number;
};

export type DetailData = {
  user: UserDetail;
  stats: Stats;
  dailyUsage: DailyUsage[];
  recentProjects: RecentProject[];
};

function fmt(s: number): string {
  if (!isFinite(s)) return "∞";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function DailyUsageChart({ data }: { data: DailyUsage[] }) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">No usage in last 30 days.</p>;
  const maxSeconds = Math.max(...data.map((d) => d.seconds), 1);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex items-end gap-0.5 h-24">
        {data.map((d) => (
          <div
            key={d.date}
            className="flex-1 group"
            style={{ height: "100%", display: "flex", alignItems: "flex-end" }}
            title={`${d.date}: ${fmt(d.seconds)}`}
          >
            <div
              className={`w-full rounded-t transition-opacity ${d.date === today ? "bg-violet-400" : "bg-violet-600"} group-hover:opacity-80`}
              style={{ height: `${Math.max((d.seconds / maxSeconds) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{data[0]?.date ?? ""}</span>
        <span>today</span>
        <span>{data[data.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

const BTN = "px-3 py-1.5 text-xs rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-50";

function UserHeader({
  user,
  disabled,
  onSetPlan,
  onResetUsage,
  onGrantAlpha,
}: {
  user: UserDetail;
  disabled: boolean;
  onSetPlan: (p: string) => void;
  onResetUsage: () => void;
  onGrantAlpha: () => void;
}) {
  return (
    <div>
      <Link href="/admin/users" className="text-sm text-gray-400 hover:text-white inline-block mb-3">
        ← Users
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{user.full_name ?? user.email}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[user.plan] ?? PLAN_COLORS.free}`}>
              {user.plan}
            </span>
          </div>
          {user.full_name && <p className="text-gray-400 text-sm mt-0.5">{user.email}</p>}
          <p className="text-gray-500 text-xs mt-0.5">Joined {formatDate(user.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            disabled={disabled}
            value={user.plan}
            onChange={(e) => onSetPlan(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
          >
            {["free", "starter", "pro", "unlimited"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="button" disabled={disabled} onClick={onResetUsage} className={BTN}>Reset Usage</button>
          <button type="button" disabled={disabled} onClick={onGrantAlpha} className={BTN}>Grant Alpha 30d</button>
        </div>
      </div>
    </div>
  );
}

function StatsRow({ stats, plan }: { stats: Stats; plan: string }) {
  const planLimit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total processing" value={fmt(stats.totalUsageSeconds)} />
      <StatCard label="This month" value={fmt(stats.thisMonthUsageSeconds)} sub={`/ ${fmt(planLimit)} limit`} />
      <StatCard label="Projects" value={String(stats.totalProjects)} sub={`${stats.thisMonthProjects} this month`} />
      <StatCard label="Exports" value={String(stats.totalExports)} sub="clips exported" />
    </div>
  );
}

function ProjectsTable({ projects }: { projects: RecentProject[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Recent Projects</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {["Title", "Status", "Created", "Clips"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs uppercase tracking-wide font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No projects</td></tr>
          ) : projects.map((p) => (
            <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/40">
              <td className="px-4 py-3">
                <Link href={`/dashboard/projects/${p.id}/studio`} className="text-violet-400 hover:text-violet-300 hover:underline truncate block max-w-xs">
                  {p.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                  {p.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.created_at)}</td>
              <td className="px-4 py-3 text-gray-300 text-xs">{p.clip_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/users/${id}/detail`)
      .then((r) => r.json() as Promise<DetailData & { error?: string }>)
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load user details"));
  }, [id, tick]);

  async function patchUser(body: Record<string, unknown>) {
    setActionLoading(true);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActionLoading(false);
    setTick((t) => t + 1);
  }

  if (error) return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm text-gray-400 hover:text-white">← Users</Link>
      <p className="text-red-400">{error}</p>
    </div>
  );

  if (!data) return <div className="flex items-center justify-center py-24 text-gray-500">Loading…</div>;

  const { user, stats, dailyUsage, recentProjects } = data;

  return (
    <div className="space-y-6">
      <UserHeader
        user={user}
        disabled={actionLoading}
        onSetPlan={(plan) => { void patchUser({ plan }); }}
        onResetUsage={() => { if (confirm("Reset daily usage to 0?")) void patchUser({ daily_usage_seconds: 0 }); }}
        onGrantAlpha={() => { void patchUser({ alpha_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }); }}
      />
      <StatsRow stats={stats} plan={user.plan} />
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Usage (last 30 days)</h2>
        <DailyUsageChart data={dailyUsage} />
      </div>
      <ProjectsTable projects={recentProjects} />
    </div>
  );
}
