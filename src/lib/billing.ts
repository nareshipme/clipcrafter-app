import { supabaseAdmin } from "@/lib/supabase";

// Pricing — TBD during alpha
export const STARTER_PRICE_INR = 99900; // ₹999/month in paise
export const PRO_PRICE_INR = 249900; // ₹2499/month in paise

export const PLAN_LIMITS: Record<string, number> = {
  free: 1800, // 30 min/month
  trial: Infinity,
  starter: 18000, // 5 hrs/month
  pro: 72000, // 20 hrs/month
};

const ALPHA_DAILY_LIMIT_SECONDS = 7200; // 2 hrs/day

type UserBillingRow = {
  plan: string;
  trial_ends_at: string | null;
  alpha_expires_at: string | null;
  daily_usage_seconds: number;
  daily_usage_reset_at: string | null;
};

export async function getUserBilling(clerkUserId: string): Promise<UserBillingRow | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("plan, trial_ends_at, alpha_expires_at, daily_usage_seconds, daily_usage_reset_at")
    .eq("clerk_id", clerkUserId)
    .single();
  return data as UserBillingRow | null;
}

export function isAlpha(user: UserBillingRow): boolean {
  if (!user.alpha_expires_at) return false;
  return new Date(user.alpha_expires_at) > new Date();
}

export function getEffectiveLimitSeconds(user: UserBillingRow): number {
  if (isAlpha(user)) return ALPHA_DAILY_LIMIT_SECONDS;
  const plan = user.plan ?? "free";
  if (plan === "trial") {
    const trialActive = user.trial_ends_at && new Date(user.trial_ends_at) > new Date();
    if (trialActive) return Infinity;
    return PLAN_LIMITS.free;
  }
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/** Returns midnight of today in IST (UTC+5:30) as a Date */
function istMidnightToday(): Date {
  const now = new Date();
  // IST offset: +5:30 = 330 minutes
  const istOffsetMs = 330 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const midnight = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  );
  // Convert back to UTC
  return new Date(midnight.getTime() - istOffsetMs);
}

export async function resetDailyUsageIfNeeded(clerkUserId: string): Promise<void> {
  const user = await getUserBilling(clerkUserId);
  if (!user) return;

  const midnightIST = istMidnightToday();
  const lastReset = user.daily_usage_reset_at ? new Date(user.daily_usage_reset_at) : null;

  if (!lastReset || lastReset < midnightIST) {
    await supabaseAdmin
      .from("users")
      .update({ daily_usage_seconds: 0, daily_usage_reset_at: new Date().toISOString() })
      .eq("clerk_id", clerkUserId);
  }
}

export async function isProcessingAllowed(
  clerkUserId: string
): Promise<{ allowed: boolean; reason?: string; secondsUsed: number; limitSeconds: number }> {
  await resetDailyUsageIfNeeded(clerkUserId);
  const user = await getUserBilling(clerkUserId);

  if (!user) {
    return { allowed: false, reason: "User not found", secondsUsed: 0, limitSeconds: 0 };
  }

  const limitSeconds = getEffectiveLimitSeconds(user);
  const secondsUsed = user.daily_usage_seconds ?? 0;

  if (limitSeconds === Infinity) {
    return { allowed: true, secondsUsed, limitSeconds };
  }

  if (secondsUsed >= limitSeconds) {
    return {
      allowed: false,
      reason: `Daily usage limit reached (${Math.floor(limitSeconds / 60)} min). Upgrade your plan for more.`,
      secondsUsed,
      limitSeconds,
    };
  }

  return { allowed: true, secondsUsed, limitSeconds };
}

export async function incrementUsageSeconds(clerkUserId: string, seconds: number): Promise<void> {
  if (!seconds || seconds <= 0) return;

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, daily_usage_seconds")
    .eq("clerk_id", clerkUserId)
    .single();

  if (!userRow) return;

  const newSeconds = (userRow.daily_usage_seconds ?? 0) + seconds;
  await supabaseAdmin
    .from("users")
    .update({ daily_usage_seconds: newSeconds })
    .eq("clerk_id", clerkUserId);

  // Log to usage_logs
  await supabaseAdmin.from("usage_logs").insert({
    user_id: userRow.id,
    seconds_used: seconds,
    logged_at: new Date().toISOString(),
  });
}
