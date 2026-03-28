"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const PLAN_STYLES: Record<string, string> = {
  free: "bg-gray-800 text-gray-400",
  trial: "bg-green-900/50 text-green-400",
  alpha: "bg-violet-900/50 text-violet-400",
  starter: "bg-blue-900/50 text-blue-400",
  pro: "bg-indigo-900/50 text-indigo-400",
  unlimited: "bg-amber-900/50 text-amber-400",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free Plan",
  trial: "Trial",
  alpha: "Alpha Access",
  starter: "Starter",
  pro: "Pro",
  unlimited: "Unlimited",
};

export function PlanBadge() {
  const [plan, setPlan] = useState<string | null>(null);
  const [isAlpha, setIsAlpha] = useState(false);

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((d) => {
        setPlan(d.plan);
        setIsAlpha(d.isAlpha);
      })
      .catch(() => {});
  }, []);

  if (!plan) return null;

  const key = isAlpha ? "alpha" : plan;
  const style = PLAN_STYLES[key] ?? PLAN_STYLES.free;
  const label = PLAN_LABELS[key] ?? plan;

  return (
    <Link
      href="/dashboard/billing"
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${style}`}
    >
      {label}
    </Link>
  );
}
