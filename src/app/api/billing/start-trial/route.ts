import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createCustomer } from "@/lib/razorpay";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, plan, trial_ends_at, razorpay_customer_id, email, full_name")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (user.plan === "trial" && user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) {
    return Response.json({ error: "Trial already active" }, { status: 409 });
  }

  // Create Razorpay customer if not already present
  let razorpayCustomerId = user.razorpay_customer_id;
  if (!razorpayCustomerId) {
    try {
      const clerkUser = await currentUser();
      const name = user.full_name ?? clerkUser?.fullName ?? "ClipCrafter User";
      const email =
        user.email ?? clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@noemail.local`;
      const customer = await createCustomer(name, email, userId);
      razorpayCustomerId = customer.id;
    } catch (err) {
      console.error("Razorpay createCustomer error:", err);
      // Non-fatal — proceed without customer ID
    }
  }

  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from("users")
    .update({
      plan: "trial",
      trial_ends_at: trialEndsAt,
      ...(razorpayCustomerId ? { razorpay_customer_id: razorpayCustomerId } : {}),
    })
    .eq("clerk_id", userId);

  return Response.json({ success: true, trialEndsAt });
}
