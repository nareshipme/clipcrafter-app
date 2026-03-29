import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

type PatchBody = {
  plan?: "free" | "starter" | "pro" | "unlimited";
  daily_usage_seconds?: number;
  alpha_expires_at?: string;
};

function isValidPlan(plan: unknown): plan is PatchBody["plan"] {
  return ["free", "starter", "pro", "unlimited"].includes(plan as string);
}

function isValidUsage(val: unknown): val is number {
  return typeof val === "number" && val >= 0;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as PatchBody;
  const updates: Record<string, unknown> = {};

  if (body.plan !== undefined) {
    if (!isValidPlan(body.plan)) return Response.json({ error: "Invalid plan" }, { status: 400 });
    updates.plan = body.plan;
  }

  if (body.daily_usage_seconds !== undefined) {
    if (!isValidUsage(body.daily_usage_seconds))
      return Response.json({ error: "Invalid daily_usage_seconds" }, { status: 400 });
    updates.daily_usage_seconds = body.daily_usage_seconds;
  }

  if (body.alpha_expires_at !== undefined) {
    updates.alpha_expires_at = body.alpha_expires_at;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, plan, daily_usage_seconds, alpha_expires_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ user: data });
}
