import { auth } from "@clerk/nextjs/server";
import { getSubscription } from "@/lib/billing";
import { createPortalSession } from "@/lib/stripe";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await getSubscription(userId);

  if (!subscription.stripe_customer_id) {
    return Response.json(
      { error: "No Stripe customer found. Please subscribe via Stripe first." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await createPortalSession(
    subscription.stripe_customer_id,
    `${baseUrl}/dashboard`
  );

  return Response.json({ url: session.url });
}
