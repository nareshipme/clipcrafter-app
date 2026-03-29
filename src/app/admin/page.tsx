"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  totalUsers: number;
  totalProjects: number;
  activeToday: number;
  failedProjects: number;
  planBreakdown: { free: number; starter: number; pro: number; unlimited: number };
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d as Stats);
      })
      .catch(() => setError("Failed to load stats"));
  }, []);

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-24 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const planPills: { label: string; count: number; color: string }[] = [
    { label: "Free", count: stats.planBreakdown.free, color: "bg-gray-700 text-gray-300" },
    { label: "Starter", count: stats.planBreakdown.starter, color: "bg-blue-900 text-blue-300" },
    { label: "Pro", count: stats.planBreakdown.pro, color: "bg-violet-900 text-violet-300" },
    {
      label: "Unlimited",
      count: stats.planBreakdown.unlimited,
      color: "bg-yellow-900 text-yellow-300",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Projects" value={stats.totalProjects} />
        <StatCard label="Active Today" value={stats.activeToday} />
        <StatCard label="Failed Projects" value={stats.failedProjects} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="text-gray-500 text-xs uppercase tracking-wide mb-3">Plan Breakdown</div>
        <div className="flex flex-wrap gap-3">
          {planPills.map((pill) => (
            <span
              key={pill.label}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${pill.color}`}
            >
              {pill.label}: {pill.count}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <Link
          href="/admin/users"
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold hover:bg-violet-500 transition-colors"
        >
          Manage Users →
        </Link>
        <Link
          href="/admin/projects"
          className="rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          Manage Projects →
        </Link>
      </div>
    </div>
  );
}
