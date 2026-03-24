import { supabaseAdmin } from "./supabase";

interface ClerkUser {
  id: string;
  emailAddresses: { emailAddress: string }[];
  firstName?: string | null;
  lastName?: string | null;
}

interface DbUser {
  clerk_id: string;
  email: string;
  full_name: string;
  plan: "free" | "pro" | "team";
  credits: number;
}

export function mapClerkUserToDb(clerkUser: ClerkUser): DbUser {
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const firstName = clerkUser.firstName ?? "";
  const lastName = clerkUser.lastName ?? "";
  const full_name = [firstName, lastName].filter(Boolean).join(" ") || email;

  return {
    clerk_id: clerkUser.id,
    email,
    full_name,
    plan: "free",
    credits: 30,
  };
}

export async function upsertUserFromClerk(clerkUser: ClerkUser): Promise<void> {
  const userData = mapClerkUserToDb(clerkUser);

  const { error } = await supabaseAdmin.from("users").upsert(userData, { onConflict: "clerk_id" });

  if (error) throw new Error(`Failed to upsert user: ${error.message}`);
}

export async function getUserByClerkId(clerkId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();

  if (error) throw new Error(`Failed to get user: ${error.message}`);
  return data;
}
