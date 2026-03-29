import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

type UsageRow = { seconds_used: number; logged_at: string };
type ProjectRaw = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  clips: { count: number }[];
};

async function fetchUsageStats(userId: string, startOfMonth: string) {
  const { data: allUsage } = await supabaseAdmin
    .from("usage_logs")
    .select("seconds_used")
    .eq("user_id", userId);

  const totalUsageSeconds = (allUsage ?? []).reduce(
    (sum: number, row: { seconds_used: number }) => sum + (row.seconds_used ?? 0),
    0
  );

  const { data: monthUsage } = await supabaseAdmin
    .from("usage_logs")
    .select("seconds_used")
    .eq("user_id", userId)
    .gte("logged_at", startOfMonth);

  const thisMonthUsageSeconds = (monthUsage ?? []).reduce(
    (sum: number, row: { seconds_used: number }) => sum + (row.seconds_used ?? 0),
    0
  );

  return { totalUsageSeconds, thisMonthUsageSeconds };
}

async function fetchDailyUsage(userId: string, thirtyDaysAgo: string) {
  const { data } = await supabaseAdmin
    .from("usage_logs")
    .select("seconds_used, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", thirtyDaysAgo)
    .order("logged_at", { ascending: true });

  const dailyMap: Record<string, number> = {};
  for (const row of (data ?? []) as UsageRow[]) {
    const date = row.logged_at.slice(0, 10);
    dailyMap[date] = (dailyMap[date] ?? 0) + (row.seconds_used ?? 0);
  }
  return Object.entries(dailyMap).map(([date, seconds]) => ({ date, seconds }));
}

async function fetchProjectStats(userId: string, startOfMonth: string) {
  const { data: allProjects, count: totalProjects } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact" })
    .eq("user_id", userId);

  const { count: thisMonthProjects } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth);

  const projectIds = (allProjects ?? []).map((p: { id: string }) => p.id);
  let totalExports = 0;
  if (projectIds.length > 0) {
    const { count } = await supabaseAdmin
      .from("clips")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds)
      .eq("status", "exported");
    totalExports = count ?? 0;
  }

  return { totalProjects: totalProjects ?? 0, thisMonthProjects: thisMonthProjects ?? 0, totalExports };
}

async function fetchRecentProjects(userId: string) {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, title, status, created_at, clips(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data as ProjectRaw[] ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    created_at: p.created_at,
    clip_count: p.clips?.[0]?.count ?? 0,
  }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select(
      "id, clerk_id, email, full_name, plan, daily_usage_seconds, trial_ends_at, alpha_expires_at, razorpay_subscription_id, created_at"
    )
    .eq("id", id)
    .single();

  if (userError || !user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [usageStats, dailyUsage, projectStats, recentProjects] = await Promise.all([
    fetchUsageStats(id, startOfMonth),
    fetchDailyUsage(id, thirtyDaysAgo),
    fetchProjectStats(id, startOfMonth),
    fetchRecentProjects(id),
  ]);

  return Response.json({
    user,
    stats: { ...usageStats, ...projectStats },
    dailyUsage,
    recentProjects,
  });
}
