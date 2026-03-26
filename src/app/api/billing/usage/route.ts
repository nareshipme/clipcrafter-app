import { auth } from "@clerk/nextjs/server";
import {
  getSubscription,
  getUsageForCurrentPeriod,
  getPlanLimitMinutes,
} from "@/lib/billing";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [subscription, usage] = await Promise.all([
    getSubscription(userId),
    getUsageForCurrentPeriod(userId),
  ]);

  const planLimit = getPlanLimitMinutes(subscription.plan);
  const effectiveLimit =
    planLimit === Infinity ? Infinity : planLimit + (usage.bonus_minutes ?? 0);
  const audioMinutesUsed = usage.audio_minutes_used ?? 0;
  const percentUsed =
    effectiveLimit === Infinity ? 0 : (audioMinutesUsed / effectiveLimit) * 100;

  return Response.json({
    plan: subscription.plan,
    audioMinutesUsed,
    limit: effectiveLimit === Infinity ? null : effectiveLimit,
    periodMonth: usage.period_month,
    percentUsed: Math.min(percentUsed, 100),
  });
}
