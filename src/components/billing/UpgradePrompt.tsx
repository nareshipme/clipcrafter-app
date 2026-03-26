"use client";

import { useState } from "react";
import { PLAN_PRICES, PLAN_LIMITS } from "@/lib/billing";

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: PLAN_PRICES.free,
    minutes: PLAN_LIMITS.free,
    features: ["30 minutes / month", "AI highlight extraction", "Export clips"],
  },
  {
    id: "pro",
    name: "Pro",
    price: PLAN_PRICES.pro,
    minutes: PLAN_LIMITS.pro,
    features: [
      "600 minutes / month",
      "AI highlight extraction",
      "Export clips",
      "Priority processing",
    ],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: PLAN_PRICES.team,
    minutes: Infinity,
    features: [
      "Unlimited minutes",
      "AI highlight extraction",
      "Export clips",
      "Priority processing",
      "Team collaboration",
    ],
  },
];

export default function UpgradePrompt({ open, onClose }: UpgradePromptProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!open) return null;

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const gatewayRes = await fetch("/api/billing/detect-gateway");
      const { gateway } = await gatewayRes.json() as { gateway: string };

      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, gateway }),
      });
      const data = await res.json() as { url?: string; subscriptionId?: string; keyId?: string; amount?: number; currency?: string };

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Razorpay inline checkout
      if (data.subscriptionId && data.keyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) {
          alert("Razorpay SDK not loaded. Please refresh and try again.");
          return;
        }
        const rzp = new Razorpay({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "ClipCrafter",
          description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
          handler: () => {
            onClose();
            window.location.href = "/dashboard?billing=success";
          },
        });
        rzp.open();
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-bold">Choose a plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl p-4 border ${
                plan.highlight
                  ? "border-violet-500 bg-violet-950/30"
                  : "border-gray-700 bg-gray-800"
              }`}
            >
              <div className="mb-4">
                <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                <p className="text-gray-300 text-2xl font-bold mt-1">
                  {plan.price === 0 ? "Free" : `$${plan.price}/mo`}
                </p>
              </div>

              <ul className="space-y-2 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="text-gray-400 text-sm flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.id !== "free" && (
                <button
                  type="button"
                  disabled={loading === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                  className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === plan.id ? "Loading…" : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
