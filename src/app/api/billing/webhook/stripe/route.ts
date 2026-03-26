export const runtime = "nodejs";

import { supabaseAdmin } from "@/lib/supabase";
import { constructWebhookEvent } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, sig);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;

      // Retrieve the subscription to get the plan
      let plan = "pro";
      if (subscriptionId) {
        // TODO: retrieve plan from Stripe subscription line items if needed
      }

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan,
          stripe_customer_id:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id ?? null,
          stripe_subscription_id: subscriptionId,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;
      if (!customerId) break;

      const periodStart = invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null;
      const periodEnd = invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null;

      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: periodStart,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;
      if (!customerId) break;

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string"
          ? sub.customer
          : sub.customer?.id ?? null;
      if (!customerId) break;

      await supabaseAdmin
        .from("subscriptions")
        .update({
          plan: "free",
          status: "cancelled",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }

  return Response.json({ received: true });
}
