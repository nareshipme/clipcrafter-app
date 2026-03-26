// TODO: install razorpay package: npm install razorpay
// TODO: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export default razorpay;

export async function createCustomer(
  name: string,
  email: string,
  userId: string
): Promise<{ id: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customer = await (razorpay.customers as any).create({
    name,
    email,
    notes: { userId },
  });
  return customer as { id: string };
}

export async function createSubscription(
  userId: string,
  planId: string
): Promise<{ id: string; short_url?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscription = await (razorpay.subscriptions as any).create({
    plan_id: planId,
    total_count: 12, // 12 billing cycles
    notes: { userId },
  });
  return subscription as { id: string; short_url?: string };
}

export function verifyWebhookSignature(body: string, sig: string): boolean {
  // TODO: set RAZORPAY_WEBHOOK_SECRET in environment variables
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expectedSig === sig;
}
