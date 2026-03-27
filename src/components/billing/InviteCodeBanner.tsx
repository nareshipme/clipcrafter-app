"use client";

import { useEffect, useState } from "react";

type UsageData = {
  plan: string;
  isAlpha: boolean;
};

export default function InviteCodeBanner() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/billing/usage");
      if (res.ok) setUsageData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsage();
  }, []);

  async function handleRedeem() {
    if (!code.trim()) return;
    setRedeeming(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const expiresAt = new Date(data.alphaExpiresAt);
        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        setSuccess(`Alpha access activated! ${daysLeft} days of access.`);
        await fetchUsage();
      } else {
        setError(data.error ?? "Failed to redeem code");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setRedeeming(false);
    }
  }

  if (loading || !usageData) return null;

  // Hide if user already has alpha access or a paid/trial plan
  if (usageData.isAlpha || usageData.plan !== "free") return null;

  return (
    <div className="bg-gray-900 border border-violet-800 rounded-lg px-4 py-4 space-y-3">
      <p className="text-sm font-semibold text-violet-300">Have an invite code?</p>
      <p className="text-xs text-gray-400">
        Enter your ALPHA-XXXX invite code to unlock 60 days of alpha access.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ALPHA-XXXX"
          maxLength={10}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={redeeming || !code.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50"
        >
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400">{success}</p>}
    </div>
  );
}
