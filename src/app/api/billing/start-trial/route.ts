import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createCustomer } from "@/lib/razorpay";

type UserRow = {
  id: string;
  plan: string;
  trial_ends_at: string | null;
  razorpay_customer_id: string | null;
  email: string | null;
  full_name: string | null;
};

/** Resolves display name and email from Supabase row or Clerk profile. */
async function getCustomerNameAndEmail(user: UserRow, userId: string) {
  const clerkUser = await currentUser();
  const name = user.full_name ?? clerkUser?.fullName ?? "ClipCrafter User";
  const email =
    user.email ?? clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@noemail.local`;
  return { name, email };
}

/**
 * Ensures the user has a Razorpay customer ID.
 * Returns existing ID immediately if already present.
 * Otherwise creates a new customer. Errors are non-fatal (returns null).
 */
async function resolveRazorpayCustomerId(user: UserRow, userId: string): Promise<string | null> {
  if (user.razorpay_customer_id) return user.razorpay_customer_id;
  try {
    const { name, email } = await getCustomerNameAndEmail(user, userId);
    const customer = await createCustomer(name, email, userId);
    return customer.id;
  } catch (err) {
    console.error("Razorpay createCustomer error:", err);
    return null; // Non-fatal — proceed without customer ID
  }
}

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

  const razorpayCustomerId = await resolveRazorpayCustomerId(user, userId);
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
