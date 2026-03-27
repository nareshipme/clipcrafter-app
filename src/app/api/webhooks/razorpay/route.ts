export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/razorpay";

async function handleSubscriptionActivated(
  clerkUserId: string,
  subscriptionId: string,
  entity: Record<string, unknown>
) {
  // Plan is inferred from the Razorpay plan_id name: IDs containing "pro" map to "pro",
  // everything else maps to "starter". Update RAZORPAY_PLAN_IDS in env once plans are live.
  const planId = entity?.plan_id as string | undefined;
  const plan = planId?.toLowerCase().includes("pro") ? "pro" : "starter";
  await supabaseAdmin
    .from("users")
    .update({
      plan,
      razorpay_subscription_id: subscriptionId,
      billing_period_start: new Date().toISOString(),
    })
    .eq("clerk_id", clerkUserId);
}

async function handleSubscriptionCharged(clerkUserId: string) {
  await supabaseAdmin
    .from("users")
    .update({ billing_period_start: new Date().toISOString() })
    .eq("clerk_id", clerkUserId);
}

async function handleSubscriptionCancelled(clerkUserId: string) {
  await supabaseAdmin
    .from("users")
    .update({ plan: "free", razorpay_subscription_id: null })
    .eq("clerk_id", clerkUserId);
}

type ParsedEvent = {
  event: string;
  clerkUserId: string;
  subscriptionId: string;
  entity: Record<string, unknown>;
} | null;

function extractEntity(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  return (
    (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown>
  )?.entity as Record<string, unknown> | undefined;
}

function parseSubscriptionEvent(body: string): ParsedEvent {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  const event = payload.event as string | undefined;
  const entity = extractEntity(payload);
  const subscriptionId = entity?.id as string | undefined;
  const clerkUserId = (entity?.notes as Record<string, string> | undefined)?.clerk_user_id;
  if (!event || !subscriptionId || !clerkUserId || !entity) return null;
  return { event, clerkUserId, subscriptionId, entity };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const parsed = parseSubscriptionEvent(body);
  if (!parsed) return Response.json({ received: true });

  const { event, clerkUserId, subscriptionId, entity } = parsed;

  if (event === "subscription.activated") {
    await handleSubscriptionActivated(clerkUserId, subscriptionId, entity);
  } else if (event === "subscription.charged") {
    await handleSubscriptionCharged(clerkUserId);
  } else if (event === "subscription.cancelled") {
    await handleSubscriptionCancelled(clerkUserId);
  }

  return Response.json({ received: true });
}
