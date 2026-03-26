import crypto from "crypto";

// TODO: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function razorpayFetch(path: string, options: RequestInit = {}) {
  const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  return fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function createCustomer(
  name: string,
  email: string,
  clerkUserId: string
): Promise<{ id: string }> {
  const res = await razorpayFetch("/customers", {
    method: "POST",
    body: JSON.stringify({ name, email, notes: { clerk_user_id: clerkUserId } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Razorpay createCustomer failed: ${err}`);
  }
  return res.json();
}

export async function createSubscription(
  clerkUserId: string,
  planId: string
): Promise<{ id: string }> {
  // TODO: Replace total_count and quantity with your plan config
  const res = await razorpayFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: 12, // 12 billing cycles
      quantity: 1,
      notes: { clerk_user_id: clerkUserId },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Razorpay createSubscription failed: ${err}`);
  }
  return res.json();
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  // TODO: Set RAZORPAY_WEBHOOK_SECRET in your environment variables
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}
