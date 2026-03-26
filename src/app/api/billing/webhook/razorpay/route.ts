export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/razorpay";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        customer_id: string;
        current_start: number | null;
        current_end: number | null;
        notes?: Record<string, string>;
      };
    };
    payment?: {
      entity: {
        id: string;
      };
    };
  };
}

export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get("x-razorpay-signature");

  if (!sig) {
    return Response.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
  }

  const valid = verifyWebhookSignature(payload, sig);
  if (!valid) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(payload) as RazorpayWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subEntity = body.payload.subscription?.entity;

  switch (body.event) {
    case "subscription.activated": {
      if (!subEntity) break;
      const userId = subEntity.notes?.userId;
      if (!userId) break;

      // Determine plan from plan_id
      const plan =
        subEntity.plan_id === (process.env.RAZORPAY_PLAN_ID_TEAM ?? "plan_team") ? "team" : "pro";

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan,
          razorpay_customer_id: subEntity.customer_id,
          razorpay_subscription_id: subEntity.id,
          status: "active",
          current_period_start: subEntity.current_start
            ? new Date(subEntity.current_start * 1000).toISOString()
            : null,
          current_period_end: subEntity.current_end
            ? new Date(subEntity.current_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "subscription.charged": {
      if (!subEntity) break;

      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: subEntity.current_start
            ? new Date(subEntity.current_start * 1000).toISOString()
            : null,
          current_period_end: subEntity.current_end
            ? new Date(subEntity.current_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("razorpay_subscription_id", subEntity.id);
      break;
    }

    case "subscription.cancelled": {
      if (!subEntity) break;

      await supabaseAdmin
        .from("subscriptions")
        .update({
          plan: "free",
          status: "cancelled",
          razorpay_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("razorpay_subscription_id", subEntity.id);
      break;
    }

    default:
      // Unhandled event — ignore
      break;
  }

  return Response.json({ received: true });
}
