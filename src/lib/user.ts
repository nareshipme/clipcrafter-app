import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Resolves (or creates) the Supabase user UUID for a given Clerk user ID.
 * Returns null if resolution fails.
 */
export async function getSupabaseUserId(clerkId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (existing) return existing.id;

  // Auto-create user — Clerk webhook may not have fired yet
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@noemail.local`;
  const full_name = clerkUser
    ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || undefined
    : undefined;

  const { data: newUser } = await supabaseAdmin
    .from("users")
    .insert({ clerk_id: clerkId, email, full_name })
    .select("id")
    .single();

  return newUser?.id ?? null;
}
