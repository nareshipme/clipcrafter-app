"use client";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Script from "next/script";

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
    price: "₹999",
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
    price: "₹2,499",
    features: [
      "20 hrs/month processing",
      "Unlimited projects",
      "Fastest processing",
      "Priority support",
    ],
  },
];

function PlanCard({
  name,
  price,
  features,
  planKey,
  isCurrent,
  onSubscribe,
  loading,
}: {
  name: string;
  price: string;
  features: string[];
  planKey: "starter" | "pro";
  isCurrent: boolean;
  onSubscribe: (plan: "starter" | "pro") => void;
  loading: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 flex flex-col gap-4 ${
        isCurrent ? "border-violet-500 bg-violet-950/30" : "border-gray-800 bg-gray-900"
      }`}
    >
      <div>
        <h2 className="text-xl font-bold">{name}</h2>
        <p className="text-3xl font-bold mt-1">
          {price}
          <span className="text-sm font-normal text-gray-400">/mo</span>
        </p>
      </div>
      <ul className="flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <span className="text-violet-400 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <div className="text-center py-2 text-sm text-violet-400 font-semibold">Current Plan</div>
      ) : (
        <button
          type="button"
          onClick={() => onSubscribe(planKey)}
          disabled={loading}
          className="block w-full text-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : `Subscribe to ${name}`}
        </button>
      )}
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
  plan: "starter" | "pro",
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
    description: plan === "pro" ? "Pro Plan — ₹2,499/month" : "Starter Plan — ₹999/month",
    image: "/favicon.ico",
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

function useBilling() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((d: BillingData & { razorpaySubscriptionId?: string }) => {
        setBilling({
          plan: d.plan,
          isTrialActive: d.isTrialActive,
          trialEndsAt: d.trialEndsAt,
          razorpaySubscriptionId: d.razorpaySubscriptionId ?? null,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return { billing, loading };
}

export default function BillingPage() {
  const { user } = useUser();
  const { billing, loading } = useBilling();
  const [subscribing, setSubscribing] = useState(false);

  async function handleSubscribe(plan: "starter" | "pro") {
    if (!user) return;
    setSubscribing(true);
    try {
      await startRazorpayCheckout(plan, user, () => setSubscribing(false));
    } catch (err) {
      console.error("Subscribe error:", err);
      setSubscribing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading billing info…</div>
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <BillingHeader billing={billing} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLANS.map((p) => (
              <PlanCard
                key={p.key}
                name={p.name}
                price={p.price}
                features={p.features}
                planKey={p.key}
                isCurrent={billing?.plan === p.key}
                onSubscribe={handleSubscribe}
                loading={subscribing}
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
