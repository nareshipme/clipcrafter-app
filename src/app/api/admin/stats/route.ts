import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

type PlanBreakdown = { free: number; starter: number; pro: number; unlimited: number };

function buildPlanBreakdown(rows: { plan: string }[]): PlanBreakdown {
  const b: PlanBreakdown = { free: 0, starter: 0, pro: 0, unlimited: 0 };
  for (const row of rows) {
    if (row.plan === "starter") b.starter++;
    else if (row.plan === "pro") b.pro++;
    else if (row.plan === "unlimited") b.unlimited++;
    else b.free++;
  }
  return b;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [
    { count: totalUsers },
    { count: totalProjects },
    { count: activeToday },
    { count: failedProjects },
    { data: planData },
  ] = await Promise.all([
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("projects").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gt("daily_usage_seconds", 0),
    supabaseAdmin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    supabaseAdmin.from("users").select("plan"),
  ]);

  return Response.json({
    totalUsers: totalUsers ?? 0,
    totalProjects: totalProjects ?? 0,
    activeToday: activeToday ?? 0,
    failedProjects: failedProjects ?? 0,
    planBreakdown: buildPlanBreakdown((planData ?? []) as { plan: string }[]),
  });
}
