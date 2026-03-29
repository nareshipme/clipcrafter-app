import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateSubscription } from "@/lib/razorpay";

type ValidPlan = "starter" | "pro" | "unlimited";

function getPlanId(plan: ValidPlan, isAlpha: boolean): string {
  if (isAlpha) {
    const ids: Record<ValidPlan, string> = {
      starter: process.env.RAZORPAY_STARTER_ALPHA_PLAN_ID ?? "",
      pro: process.env.RAZORPAY_PRO_ALPHA_PLAN_ID ?? "",
      unlimited: process.env.RAZORPAY_UNLIMITED_ALPHA_PLAN_ID ?? "",
    };
    return ids[plan];
  }
  const ids: Record<ValidPlan, string> = {
    starter: process.env.RAZORPAY_STARTER_PLAN_ID ?? "",
    pro: process.env.RAZORPAY_PRO_PLAN_ID ?? "",
    unlimited: process.env.RAZORPAY_UNLIMITED_PLAN_ID ?? "",
  };
  return ids[plan];
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const plan = body.plan as string;
  if (plan !== "starter" && plan !== "pro" && plan !== "unlimited") {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("razorpay_subscription_id, alpha_expires_at")
    .eq("clerk_id", userId)
    .single();

  if (!user?.razorpay_subscription_id) {
    return Response.json({ error: "No active subscription found" }, { status: 400 });
  }

  const isAlpha = !!user.alpha_expires_at && new Date(user.alpha_expires_at) > new Date();
  const newPlanId = getPlanId(plan as ValidPlan, isAlpha);
  if (!newPlanId) {
    return Response.json({ error: "Plan not configured" }, { status: 500 });
  }

  try {
    await updateSubscription(user.razorpay_subscription_id, newPlanId);
  } catch (err) {
    console.error("Razorpay updateSubscription error:", err);
    return Response.json({ error: "Failed to update subscription" }, { status: 500 });
  }

  await supabaseAdmin.from("users").update({ plan }).eq("clerk_id", userId);

  return Response.json({ ok: true, plan });
}
