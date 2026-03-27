"use client";

import { useEffect, useState } from "react";

type UsageData = {
  plan: string;
  isAlpha: boolean;
  alphaExpiresAt: string | null;
  alphaExpiresInDays: number | null;
  dailyUsageSeconds: number;
  dailyLimitSeconds: number | null;
  trialEndsAt: string | null;
  isTrialActive: boolean;
};

type WarnLevel = "normal" | "yellow" | "red";

function ProgressBar({ pct, warn }: { pct: number; warn: WarnLevel }) {
  const colors = { normal: "bg-violet-500", yellow: "bg-yellow-400", red: "bg-red-500" };
  return (
    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colors[warn]}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function warnLevel(pct: number): WarnLevel {
  if (pct >= 100) return "red";
  if (pct >= 80) return "yellow";
  return "normal";
}

function AlphaMeter({ data }: { data: UsageData }) {
  const pct = (data.dailyUsageSeconds / 7200) * 100;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-violet-400 font-semibold">Alpha Access</span>
        <span className="text-gray-400">{data.alphaExpiresInDays} days left</span>
      </div>
      <ProgressBar pct={pct} warn={warnLevel(pct)} />
      <p className="text-xs text-gray-500">
        {formatMinutes(data.dailyUsageSeconds)} / 2h used today
        {pct >= 100 && <span className="text-red-400 ml-1">— daily limit reached</span>}
      </p>
    </div>
  );
}

function daysUntil(isoDate: string): number {
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function TrialMeter({ data }: { data: UsageData }) {
  const trialDaysLeft = daysUntil(data.trialEndsAt!);
  const pct = data.dailyLimitSeconds ? (data.dailyUsageSeconds / data.dailyLimitSeconds) * 100 : 0;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-green-400 font-semibold">Free Trial</span>
        <span className="text-gray-400">{trialDaysLeft} days left</span>
      </div>
      {data.dailyLimitSeconds !== null && (
        <>
          <ProgressBar pct={pct} warn={warnLevel(pct)} />
          <p className="text-xs text-gray-500">
            {formatMinutes(data.dailyUsageSeconds)} / {formatMinutes(data.dailyLimitSeconds)} used
          </p>
        </>
      )}
    </div>
  );
}

function FreeMeter({
  data,
  onStartTrial,
  startingTrial,
}: {
  data: UsageData;
  onStartTrial: () => void;
  startingTrial: boolean;
}) {
  const freeLimitSeconds = 1800;
  const pct = (data.dailyUsageSeconds / freeLimitSeconds) * 100;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300 font-semibold">Free Plan</span>
        <span className="text-gray-400">30 min/month</span>
      </div>
      <ProgressBar pct={pct} warn={warnLevel(pct)} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {formatMinutes(data.dailyUsageSeconds)} / 30m used
          {pct >= 100 && <span className="text-red-400 ml-1">— limit reached</span>}
        </p>
        <button
          type="button"
          onClick={onStartTrial}
          disabled={startingTrial}
          className="text-xs text-violet-400 hover:text-violet-300 font-semibold disabled:opacity-50"
        >
          {startingTrial ? "Starting…" : "Start Free Trial"}
        </button>
      </div>
    </div>
  );
}

export default function UsageMeter() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingTrial, setStartingTrial] = useState(false);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/billing/usage");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsage();
  }, []);

  async function handleStartTrial() {
    setStartingTrial(true);
    try {
      const res = await fetch("/api/billing/start-trial", { method: "POST" });
      if (res.ok) await fetchUsage();
    } finally {
      setStartingTrial(false);
    }
  }

  if (loading) return <div className="h-10 bg-gray-900 rounded-lg animate-pulse" />;
  if (!data) return null;

  if (data.isAlpha) return <AlphaMeter data={data} />;
  if (data.plan === "trial" && data.isTrialActive && data.trialEndsAt)
    return <TrialMeter data={data} />;
  return <FreeMeter data={data} onStartTrial={handleStartTrial} startingTrial={startingTrial} />;
}
