// TODO: install stripe package: npm install stripe
// TODO: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in environment variables
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export default stripe;

export async function createCustomer(
  email: string,
  userId: string
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    metadata: { userId },
  });
}

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export function constructWebhookEvent(
  payload: string | Buffer,
  sig: string
): Stripe.Event {
  // TODO: set STRIPE_WEBHOOK_SECRET in environment variables
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  return stripe.webhooks.constructEvent(payload, sig, webhookSecret);
}
