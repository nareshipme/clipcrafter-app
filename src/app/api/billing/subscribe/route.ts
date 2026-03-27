import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { createCustomer, createSubscription } from "@/lib/razorpay";

type ValidPlan = "starter" | "pro";

function getPlanId(plan: ValidPlan): string {
  const ids: Record<ValidPlan, string> = {
    starter: process.env.RAZORPAY_STARTER_PLAN_ID ?? "",
    pro: process.env.RAZORPAY_PRO_PLAN_ID ?? "",
  };
  return ids[plan];
}

async function getOrCreateCustomer(userId: string, supabaseUserId: string): Promise<string> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("razorpay_customer_id, email, full_name")
    .eq("id", supabaseUserId)
    .single();

  if (user?.razorpay_customer_id) return user.razorpay_customer_id;

  const customer = await createCustomer(
    user?.full_name ?? "ClipCrafter User",
    user?.email ?? `${userId}@noemail.local`,
    userId
  );

  await supabaseAdmin
    .from("users")
    .update({ razorpay_customer_id: customer.id })
    .eq("id", supabaseUserId);

  return customer.id;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const body = await request.json();
  const plan = body.plan as string;
  if (plan !== "starter" && plan !== "pro") {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  const planId = getPlanId(plan);
  if (!planId) return Response.json({ error: "Plan not configured" }, { status: 500 });

  const customerId = await getOrCreateCustomer(userId, supabaseUserId);
  const subscription = await createSubscription(userId, planId);

  return Response.json({ subscriptionId: subscription.id, customerId });
}
