import { supabaseAdmin } from "@/lib/supabase";

export const PLAN_LIMITS: Record<string, number> = {
  free: 30,
  pro: 600,
  team: Infinity,
};

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 9,
  team: 29,
};

export type Plan = "free" | "pro" | "team";

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  stripe_customer_id: string | null;
  razorpay_customer_id: string | null;
  stripe_subscription_id: string | null;
  razorpay_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  period_month: string;
  audio_minutes_used: number;
  bonus_minutes: number;
  updated_at: string;
}

export async function getSubscription(userId: string): Promise<Subscription> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!data) {
    return {
      id: "",
      user_id: userId,
      plan: "free",
      stripe_customer_id: null,
      razorpay_customer_id: null,
      stripe_subscription_id: null,
      razorpay_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as Subscription;
}

function getCurrentPeriodMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getUsageForCurrentPeriod(userId: string): Promise<UsageRecord> {
  const periodMonth = getCurrentPeriodMonth();

  const { data } = await supabaseAdmin
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .eq("period_month", periodMonth)
    .single();

  if (!data) {
    return {
      id: "",
      user_id: userId,
      period_month: periodMonth,
      audio_minutes_used: 0,
      bonus_minutes: 0,
      updated_at: new Date().toISOString(),
    };
  }

  return data as UsageRecord;
}

export async function incrementUsage(userId: string, minutes: number): Promise<void> {
  const periodMonth = getCurrentPeriodMonth();

  // Fetch existing usage so we can compute the new total
  const current = await getUsageForCurrentPeriod(userId);
  const newTotal = (current.audio_minutes_used ?? 0) + minutes;

  await supabaseAdmin.from("usage").upsert(
    {
      user_id: userId,
      period_month: periodMonth,
      audio_minutes_used: newTotal,
      bonus_minutes: current.bonus_minutes ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,period_month" }
  );
}

export function getPlanLimitMinutes(plan: string): number {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export async function getEffectiveLimitMinutes(userId: string): Promise<number> {
  const [subscription, usage] = await Promise.all([
    getSubscription(userId),
    getUsageForCurrentPeriod(userId),
  ]);

  const planLimit = getPlanLimitMinutes(subscription.plan);
  if (planLimit === Infinity) return Infinity;
  return planLimit + (usage.bonus_minutes ?? 0);
}

export async function isUsageAllowed(
  userId: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [subscription, usage] = await Promise.all([
    getSubscription(userId),
    getUsageForCurrentPeriod(userId),
  ]);

  const planLimit = getPlanLimitMinutes(subscription.plan);
  const effectiveLimit = planLimit === Infinity ? Infinity : planLimit + (usage.bonus_minutes ?? 0);
  const used = usage.audio_minutes_used ?? 0;

  return {
    allowed: effectiveLimit === Infinity || used < effectiveLimit,
    used,
    limit: effectiveLimit,
  };
}
