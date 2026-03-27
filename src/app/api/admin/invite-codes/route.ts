import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// TODO: Replace with a proper admin check (e.g. Clerk organization role or allowlist)
function isAdmin(_userId: string): boolean {
  const adminIds = (process.env.ADMIN_CLERK_USER_IDS ?? "").split(",").filter(Boolean);
  return adminIds.includes(_userId);
}

function generateAlphaCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ALPHA-${suffix}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Enforce admin check once admin user IDs are configured
  if (!isAdmin(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let count: number;
  try {
    const body = await request.json();
    count = parseInt(body.count, 10);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!count || count < 1 || count > 100) {
    return Response.json({ error: "count must be between 1 and 100" }, { status: 400 });
  }

  // Generate unique codes (retry on collision)
  const codes: string[] = [];
  const maxAttempts = count * 5;
  let attempts = 0;

  while (codes.length < count && attempts < maxAttempts) {
    attempts++;
    const candidate = generateAlphaCode();
    if (codes.includes(candidate)) continue;

    const { data: existing } = await supabaseAdmin
      .from("invite_codes")
      .select("id")
      .eq("code", candidate)
      .single();

    if (!existing) codes.push(candidate);
  }

  if (codes.length < count) {
    return Response.json({ error: "Could not generate enough unique codes" }, { status: 500 });
  }

  const rows = codes.map((code) => ({ code, created_by: userId }));
  await supabaseAdmin.from("invite_codes").insert(rows);

  return Response.json({ codes });
}
