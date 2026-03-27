export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event as string | undefined;
  const subscriptionEntity = (
    (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown>
  )?.entity as Record<string, unknown> | undefined;

  const subscriptionId = subscriptionEntity?.id as string | undefined;
  const clerkUserId = (subscriptionEntity?.notes as Record<string, string> | undefined)
    ?.clerk_user_id;

  if (!subscriptionId || !clerkUserId) {
    // Not an event we can act on
    return Response.json({ received: true });
  }

  if (event === "subscription.activated") {
    // Determine plan from plan_id notes or default to starter
    const planId = subscriptionEntity?.plan_id as string | undefined;
    // TODO: Map Razorpay plan IDs to ClipCrafter plan names when plan IDs are configured
    const plan = planId?.toLowerCase().includes("pro") ? "pro" : "starter";

    await supabaseAdmin
      .from("users")
      .update({
        plan,
        razorpay_subscription_id: subscriptionId,
        billing_period_start: new Date().toISOString(),
      })
      .eq("clerk_id", clerkUserId);
  } else if (event === "subscription.charged") {
    await supabaseAdmin
      .from("users")
      .update({ billing_period_start: new Date().toISOString() })
      .eq("clerk_id", clerkUserId);
  } else if (event === "subscription.cancelled") {
    await supabaseAdmin
      .from("users")
      .update({ plan: "free", razorpay_subscription_id: null })
      .eq("clerk_id", clerkUserId);
  }

  return Response.json({ received: true });
}
