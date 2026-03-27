import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserBilling, isAlpha, getEffectiveLimitSeconds } from "@/lib/billing";

function getAlphaExpiresInDays(alphaExpiresAt: string | null): number | null {
  if (!alphaExpiresAt) return null;
  const diff = new Date(alphaExpiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function fetchRazorpaySubscriptionId(clerkId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("razorpay_subscription_id")
    .eq("clerk_id", clerkId)
    .single();
  return data?.razorpay_subscription_id ?? null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBilling(userId);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const alpha = isAlpha(user);
  const limitSeconds = getEffectiveLimitSeconds(user);
  const alphaExpiresAt = user.alpha_expires_at ?? null;
  const trialEndsAt = user.trial_ends_at ?? null;
  const isTrialActive = !!trialEndsAt && new Date(trialEndsAt) > new Date();
  const alphaExpiresInDays = getAlphaExpiresInDays(alphaExpiresAt);
  const razorpaySubscriptionId = await fetchRazorpaySubscriptionId(userId);

  return Response.json({
    plan: user.plan,
    isAlpha: alpha,
    alphaExpiresAt,
    alphaExpiresInDays,
    dailyUsageSeconds: user.daily_usage_seconds ?? 0,
    dailyLimitSeconds: limitSeconds === Infinity ? null : limitSeconds,
    trialEndsAt,
    isTrialActive,
    razorpaySubscriptionId,
  });
}
