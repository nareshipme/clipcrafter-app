import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

const PAGE_SIZE = 20;

export async function GET(_request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, count, error } = await supabaseAdmin
    .from("projects")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    { projects: data ?? [], total: count ?? 0 },
    { status: 200 }
  );
}
