import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const search = searchParams.get("search") ?? "";
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("users")
    .select(
      "id, clerk_id, email, full_name, plan, daily_usage_seconds, alpha_expires_at, trial_ends_at, created_at, projects(count)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  type RawUser = {
    id: string;
    clerk_id: string;
    email: string;
    full_name: string | null;
    plan: string;
    daily_usage_seconds: number;
    alpha_expires_at: string | null;
    trial_ends_at: string | null;
    created_at: string;
    projects: { count: number }[];
  };

  const users = (data as RawUser[]).map((u) => ({
    id: u.id,
    clerk_id: u.clerk_id,
    email: u.email,
    full_name: u.full_name,
    plan: u.plan,
    daily_usage_seconds: u.daily_usage_seconds,
    alpha_expires_at: u.alpha_expires_at,
    trial_ends_at: u.trial_ends_at,
    created_at: u.created_at,
    project_count: u.projects?.[0]?.count ?? 0,
  }));

  return Response.json({ users, total: count ?? 0 });
}
