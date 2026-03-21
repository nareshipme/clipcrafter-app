import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, type, youtubeUrl } = body as { title?: string; type?: string; youtubeUrl?: string };

  if (!title || typeof title !== "string" || title.trim() === "") {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (type !== "upload" && type !== "youtube") {
    return Response.json(
      { error: 'type must be "upload" or "youtube"' },
      { status: 400 }
    );
  }
  if (type === "youtube" && !youtubeUrl) {
    return Response.json({ error: "youtubeUrl is required for type=youtube" }, { status: 400 });
  }

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) {
    return Response.json({ error: "Failed to resolve user" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: supabaseUserId,
      title: title.trim(),
      type,
      status: "pending",
      // For YouTube projects, store the URL in r2_key so the Inngest job can pick it up
      ...(type === "youtube" && youtubeUrl ? { r2_key: youtubeUrl.trim() } : {}),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(
    { id: data.id, title: data.title, status: data.status, created_at: data.created_at },
    { status: 201 }
  );
}
