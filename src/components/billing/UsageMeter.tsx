"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UsageData {
  plan: string;
  audioMinutesUsed: number;
  limit: number | null;
  periodMonth: string;
  percentUsed: number;
}

export default function UsageMeter() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((data: UsageData) => setUsage(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-12 bg-gray-800 rounded-lg animate-pulse" />
    );
  }

  if (!usage) return null;

  const isUnlimited = usage.limit === null;
  const percent = isUnlimited ? 0 : Math.min(usage.percentUsed, 100);
  const isWarning = percent >= 80 && percent < 100;
  const isFull = percent >= 100;

  const barColor = isFull
    ? "bg-red-500"
    : isWarning
    ? "bg-yellow-500"
    : "bg-green-500";

  const limitLabel = isUnlimited ? "unlimited" : `${usage.limit} min`;
  const usedLabel = `${Math.round(usage.audioMinutesUsed)} min used of ${limitLabel}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 capitalize">{usage.plan} plan</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-300">{usedLabel}</span>
          {(isWarning || isFull) && (
            <Link
              href="/pricing"
              className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`${barColor} h-2 rounded-full transition-all`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
