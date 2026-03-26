"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLAN_PRICES, PLAN_LIMITS } from "@/lib/billing";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: PLAN_PRICES.free,
    minutesLabel: "30 min / month",
    features: ["30 minutes of audio per month", "AI highlight extraction", "Export clips"],
  },
  {
    id: "pro",
    name: "Pro",
    price: PLAN_PRICES.pro,
    minutesLabel: "600 min / month",
    features: [
      "600 minutes of audio per month",
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
    minutesLabel: "Unlimited",
    features: [
      "Unlimited audio",
      "AI highlight extraction",
      "Export clips",
      "Priority processing",
      "Team collaboration",
    ],
  },
];

export default function PricingPage() {
  const [gateway, setGateway] = useState<"stripe" | "razorpay">("stripe");
  const [loading, setLoading] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/detect-gateway")
      .then((r) => r.json())
      .then((d: { gateway: "stripe" | "razorpay" }) => setGateway(d.gateway))
      .catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") setBillingStatus("success");
    if (params.get("billing") === "cancelled") setBillingStatus("cancelled");
  }, []);

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, gateway }),
      });
      const data = (await res.json()) as {
        url?: string;
        subscriptionId?: string;
        keyId?: string;
        amount?: number;
        currency?: string;
      };

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
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
        <Link href="/dashboard" className="text-lg sm:text-xl font-bold">
          ClipCrafter
        </Link>
      </header>

      <main className="px-4 sm:px-6 py-12 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-gray-400 text-lg">Start free, upgrade when you need more.</p>
          {gateway === "razorpay" && (
            <p className="text-gray-500 text-sm mt-2">
              Prices shown in USD · Charged in INR at current exchange rates
            </p>
          )}
        </div>

        {billingStatus === "success" && (
          <div className="mb-8 bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-4 text-center">
            Subscription activated! Your plan has been upgraded.
          </div>
        )}
        {billingStatus === "cancelled" && (
          <div className="mb-8 bg-yellow-900/30 border border-yellow-700 text-yellow-300 rounded-lg p-4 text-center">
            Checkout cancelled. You can upgrade whenever you&apos;re ready.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 border ${
                plan.highlight
                  ? "border-violet-500 bg-violet-950/20"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              {plan.highlight && (
                <div className="text-violet-400 text-xs font-semibold uppercase tracking-widest mb-3">
                  Most popular
                </div>
              )}
              <h2 className="text-white text-2xl font-bold">{plan.name}</h2>
              <p className="text-gray-300 text-3xl font-bold mt-2 mb-1">
                {plan.price === 0 ? "Free" : `$${plan.price}`}
                {plan.price > 0 && (
                  <span className="text-gray-500 text-base font-normal"> / month</span>
                )}
              </p>
              <p className="text-gray-500 text-sm mb-6">{plan.minutesLabel}</p>

              <ul className="space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.id === "free" ? (
                <Link
                  href="/dashboard"
                  className="block text-center w-full rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Get started free
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={loading === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.highlight
                      ? "bg-violet-600 hover:bg-violet-500"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  {loading === plan.id ? "Loading…" : `Get ${plan.name}`}
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
