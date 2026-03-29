"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Script from "next/script";
import { toast } from "sonner";

type BillingData = {
  plan: string;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  razorpaySubscriptionId: string | null;
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

const PLANS = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "₹9",
    originalPrice: "₹999",
    features: [
      "5 hrs/month processing",
      "Unlimited projects",
      "Priority processing",
      "Email support",
    ],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "₹90",
    originalPrice: "₹2,499",
    features: [
      "20 hrs/month processing",
      "Unlimited projects",
      "Fastest processing",
      "Priority support",
    ],
  },
  {
    key: "unlimited" as const,
    name: "Unlimited",
    price: "₹999",
    originalPrice: "₹9,999",
    features: [
      "Unlimited processing",
      "Unlimited projects",
      "Fastest processing",
      "Dedicated support",
    ],
  },
];

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  trial: 0,
  starter: 1,
  pro: 2,
  unlimited: 3,
};

type PlanKey = "starter" | "pro" | "unlimited";
type PlanHandler = (plan: PlanKey) => void;

function PlanCardAction({
  isCurrent,
  isHigher,
  isLower,
  hasActiveSubscription,
  planKey,
  onSubscribe,
  onUpgrade,
  subscribing,
  upgrading,
}: {
  isCurrent: boolean;
  isHigher: boolean;
  isLower: boolean;
  hasActiveSubscription: boolean;
  planKey: PlanKey;
  onSubscribe: PlanHandler;
  onUpgrade: PlanHandler;
  subscribing: boolean;
  upgrading: boolean;
}) {
  const btnBase =
    "block w-full text-center rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors";
  if (isCurrent)
    return (
      <div className="text-center py-2 text-sm text-violet-400 font-semibold">Current Plan</div>
    );
  if (isHigher && hasActiveSubscription)
    return (
      <button
        type="button"
        onClick={() => onUpgrade(planKey)}
        disabled={upgrading}
        className={`${btnBase} bg-violet-600 hover:bg-violet-500`}
      >
        {upgrading ? "Upgrading…" : "Upgrade"}
      </button>
    );
  if (isHigher)
    return (
      <button
        type="button"
        onClick={() => onSubscribe(planKey)}
        disabled={subscribing}
        className={`${btnBase} bg-violet-600 hover:bg-violet-500`}
      >
        {subscribing ? "Loading…" : "Upgrade"}
      </button>
    );
  if (isLower)
    return (
      <button
        type="button"
        onClick={() => onUpgrade(planKey)}
        disabled={upgrading}
        title="Takes effect at end of billing cycle"
        className={`${btnBase} border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200`}
      >
        {upgrading ? "Updating…" : "Downgrade"}
      </button>
    );
  return null;
}

function PlanCard({
  name,
  price,
  originalPrice,
  features,
  planKey,
  isCurrent,
  planRank,
  currentPlanRank,
  hasActiveSubscription,
  onSubscribe,
  onUpgrade,
  subscribing,
  upgrading,
}: {
  name: string;
  price: string;
  originalPrice?: string;
  features: string[];
  planKey: PlanKey;
  isCurrent: boolean;
  planRank: number;
  currentPlanRank: number;
  hasActiveSubscription: boolean;
  onSubscribe: PlanHandler;
  onUpgrade: PlanHandler;
  subscribing: boolean;
  upgrading: boolean;
}) {
  const isHigher = planRank > currentPlanRank;
  const isLower = planRank < currentPlanRank && hasActiveSubscription;

  return (
    <div
      className={`rounded-xl border p-6 flex flex-col gap-4 ${
        isCurrent ? "border-violet-500 bg-violet-950/30" : "border-gray-800 bg-gray-900"
      }`}
    >
      <div>
        <h2 className="text-xl font-bold">{name}</h2>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-3xl font-bold">
            {price}
            <span className="text-sm font-normal text-gray-400">/mo</span>
          </p>
          {originalPrice && (
            <span className="text-sm text-gray-500 line-through">{originalPrice}/mo</span>
          )}
        </div>
        {originalPrice && (
          <span className="inline-block mt-1 text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
            Alpha pricing until June 2026
          </span>
        )}
      </div>
      <ul className="flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <span className="text-violet-400 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <PlanCardAction
        isCurrent={isCurrent}
        isHigher={isHigher}
        isLower={isLower}
        hasActiveSubscription={hasActiveSubscription}
        planKey={planKey}
        onSubscribe={onSubscribe}
        onUpgrade={onUpgrade}
        subscribing={subscribing}
        upgrading={upgrading}
      />
    </div>
  );
}

function BillingHeader({ billing }: { billing: BillingData | null }) {
  const trialBadge =
    billing?.isTrialActive && billing?.trialEndsAt ? (
      <span className="ml-2 text-green-400 text-sm">
        (trial ends {new Date(billing.trialEndsAt).toLocaleDateString()})
      </span>
    ) : null;

  return (
    <div className="mb-8">
      <a href="/dashboard" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        ← Back to Dashboard
      </a>
      <h1 className="text-3xl font-bold">Billing</h1>
      <p className="text-gray-400 mt-1">
        Current plan:{" "}
        <span className="text-white font-semibold capitalize">{billing?.plan ?? "free"}</span>
        {trialBadge}
      </p>
    </div>
  );
}

type RazorpayUser = {
  fullName: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

async function startRazorpayCheckout(
  plan: "starter" | "pro" | "unlimited",
  user: RazorpayUser,
  onDismiss: () => void
) {
  const res = await fetch("/api/billing/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const { subscriptionId, customerId, error } = await res.json();
  if (error) throw new Error(error);

  const rzp = new window.Razorpay({
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    subscription_id: subscriptionId,
    name: "ClipCrafter",
    description:
      plan === "unlimited"
        ? "Unlimited Plan — ₹9,999/month"
        : plan === "pro"
          ? "Pro Plan — ₹2,499/month"
          : "Starter Plan — ₹999/month",
    image: "/favicon.ico",
    method: {
      card: true,
      upi: true,
      netbanking: false,
      wallet: false,
    },
    prefill: {
      name: user.fullName ?? "",
      email: user.primaryEmailAddress?.emailAddress ?? "",
      contact: "",
    },
    customer_id: customerId,
    handler: () => {
      window.location.href = "/dashboard?subscribed=1";
    },
    modal: { ondismiss: onDismiss },
    theme: { color: "#7c3aed" },
  });
  rzp.open();
}

function useUpgrade(refetch: () => Promise<void>) {
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade(plan: PlanKey) {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update plan");
        return;
      }
      toast.success(`Plan updated to ${plan}. Changes take effect at end of billing cycle.`);
      await refetch();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setUpgrading(false);
    }
  }

  return { upgrading, handleUpgrade };
}

function useBilling() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/billing/usage");
      const d = await r.json();
      setBilling({
        plan: d.plan,
        isTrialActive: d.isTrialActive,
        trialEndsAt: d.trialEndsAt,
        razorpaySubscriptionId: d.razorpaySubscriptionId ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  return { billing, loading, refetch: fetchBilling };
}

export default function BillingPage() {
  const { user } = useUser();
  const { billing, loading, refetch } = useBilling();
  const [subscribing, setSubscribing] = useState(false);
  const { upgrading, handleUpgrade } = useUpgrade(refetch);

  async function handleSubscribe(plan: PlanKey) {
    if (!user) return;
    setSubscribing(true);
    try {
      await startRazorpayCheckout(plan, user, () => setSubscribing(false));
    } catch (err) {
      console.error("Subscribe error:", err);
      setSubscribing(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading billing info…</div>
      </div>
    );

  const currentPlanRank = PLAN_ORDER[billing?.plan ?? "free"] ?? 0;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <BillingHeader billing={billing} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((p) => (
              <PlanCard
                key={p.key}
                name={p.name}
                price={p.price}
                originalPrice={p.originalPrice}
                features={p.features}
                planKey={p.key}
                isCurrent={billing?.plan === p.key}
                planRank={PLAN_ORDER[p.key]}
                currentPlanRank={currentPlanRank}
                hasActiveSubscription={!!billing?.razorpaySubscriptionId}
                onSubscribe={handleSubscribe}
                onUpgrade={handleUpgrade}
                subscribing={subscribing}
                upgrading={upgrading}
              />
            ))}
          </div>
          {billing?.razorpaySubscriptionId && (
            <p className="mt-8 text-sm text-gray-500 text-center">
              To cancel your subscription, contact support at{" "}
              <a href="mailto:clipcrafterapp@gmail.com" className="text-violet-400 hover:underline">
                clipcrafterapp@gmail.com
              </a>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
