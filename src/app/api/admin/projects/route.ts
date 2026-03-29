import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/admin";

type RawProject = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  r2_key: string | null;
  users: { email: string } | { email: string }[];
};

function parseParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    status: searchParams.get("status") ?? "",
    user_id: searchParams.get("user_id") ?? "",
  };
}

function toUserEmail(users: RawProject["users"]): string | undefined {
  return Array.isArray(users) ? users[0]?.email : users?.email;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const {
    page: _page,
    limit,
    offset,
    status,
    user_id,
  } = parseParams(new URL(request.url).searchParams);

  let query = supabaseAdmin
    .from("projects")
    .select("id, title, status, created_at, r2_key, users!inner(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (user_id) query = query.eq("user_id", user_id);

  const { data, count, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const projects = (data as RawProject[]).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    created_at: p.created_at,
    r2_key: p.r2_key,
    user_email: toUserEmail(p.users),
  }));

  return Response.json({ projects, total: count ?? 0 });
}
