import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSubscription } from "@/lib/billing";
import { createCheckoutSession, createCustomer as createStripeCustomer } from "@/lib/stripe";
import {
  createCustomer as createRazorpayCustomer,
  createSubscription as createRazorpaySubscription,
} from "@/lib/razorpay";

// TODO: set these Stripe price IDs in environment variables
const STRIPE_PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_ID_PRO ?? "price_pro",
  team: process.env.STRIPE_PRICE_ID_TEAM ?? "price_team",
};

// TODO: set these Razorpay plan IDs in environment variables
const RAZORPAY_PLAN_IDS: Record<string, string> = {
  pro: process.env.RAZORPAY_PLAN_ID_PRO ?? "plan_pro",
  team: process.env.RAZORPAY_PLAN_ID_TEAM ?? "plan_team",
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { plan, gateway } = body as { plan: string; gateway: "stripe" | "razorpay" };

  if (!plan || plan === "free") {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (gateway !== "stripe" && gateway !== "razorpay") {
    return Response.json({ error: "Invalid gateway" }, { status: 400 });
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@noemail.local`;
  const name = `${clerkUser?.firstName ?? ""} ${clerkUser?.lastName ?? ""}`.trim() || email;

  const subscription = await getSubscription(userId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (gateway === "stripe") {
    let customerId = subscription.stripe_customer_id;

    if (!customerId) {
      const customer = await createStripeCustomer(email, userId);
      customerId = customer.id;

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          plan: subscription.plan,
          stripe_customer_id: customerId,
          status: subscription.status ?? "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    const priceId = STRIPE_PRICE_IDS[plan];
    const session = await createCheckoutSession(
      userId,
      priceId,
      `${baseUrl}/dashboard?billing=success`,
      `${baseUrl}/pricing?billing=cancelled`
    );

    return Response.json({ url: session.url });
  }

  // Razorpay flow
  let rpCustomerId = subscription.razorpay_customer_id;

  if (!rpCustomerId) {
    const customer = await createRazorpayCustomer(name, email, userId);
    rpCustomerId = customer.id;

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: subscription.plan,
        razorpay_customer_id: rpCustomerId,
        status: subscription.status ?? "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

  const planId = RAZORPAY_PLAN_IDS[plan];
  const rpSubscription = await createRazorpaySubscription(userId, planId);

  return Response.json({
    subscriptionId: rpSubscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
    amount: plan === "pro" ? 74900 : 241700, // INR paise (₹749 or ₹2417)
    currency: "INR",
  });
}
