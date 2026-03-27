import { auth } from "@clerk/nextjs/server";
import { getUserBilling, isAlpha, getEffectiveLimitSeconds } from "@/lib/billing";

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

  const now = new Date();
  const alphaExpiresAt = user.alpha_expires_at ?? null;
  const trialEndsAt = user.trial_ends_at ?? null;
  const isTrialActive = !!trialEndsAt && new Date(trialEndsAt) > now;

  let alphaExpiresInDays: number | null = null;
  if (alphaExpiresAt) {
    const diff = new Date(alphaExpiresAt).getTime() - now.getTime();
    alphaExpiresInDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return Response.json({
    plan: user.plan,
    isAlpha: alpha,
    alphaExpiresAt,
    alphaExpiresInDays,
    dailyUsageSeconds: user.daily_usage_seconds ?? 0,
    dailyLimitSeconds: limitSeconds === Infinity ? null : limitSeconds,
    trialEndsAt,
    isTrialActive,
  });
}
