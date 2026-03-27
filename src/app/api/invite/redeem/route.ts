import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let code: string;
  try {
    const body = await request.json();
    code = (body.code as string)?.trim().toUpperCase();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!code) {
    return Response.json({ error: "Missing invite code" }, { status: 400 });
  }

  const { data: invite } = await supabaseAdmin
    .from("invite_codes")
    .select("id, redeemed_by, redeemed_at, expires_at")
    .eq("code", code)
    .single();

  if (!invite) {
    return Response.json({ error: "Invalid invite code" }, { status: 404 });
  }

  if (invite.redeemed_by) {
    return Response.json({ error: "Invite code already used" }, { status: 409 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: "Invite code has expired" }, { status: 410 });
  }

  const alphaExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  // Mark code as redeemed
  await supabaseAdmin
    .from("invite_codes")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Grant alpha access to user
  await supabaseAdmin
    .from("users")
    .update({
      alpha_expires_at: alphaExpiresAt,
      invite_code_used: code,
      daily_usage_seconds: 0,
    })
    .eq("clerk_id", userId);

  return Response.json({ success: true, alphaExpiresAt });
}
