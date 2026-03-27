import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

async function fetchTranscriptAndHighlights(id: string): Promise<{
  transcript: { id: string; segments: unknown[] } | null;
  highlights: { id: string; segments: unknown[] } | null;
}> {
  const [tResult, hResult] = await Promise.all([
    supabaseAdmin
      .from("transcripts")
      .select("id, segments")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabaseAdmin
      .from("highlights")
      .select("id, segments")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);
  return {
    transcript: tResult.data ?? null,
    highlights: hResult.data ?? null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) {
    return Response.json({ error: "Failed to resolve user" }, { status: 500 });
  }

  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, title, status, error_message, completed_at, processing_log, stitch_url")
    .eq("id", id)
    .single();

  if (error || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== supabaseUserId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { transcript, highlights } =
    project.status === "completed"
      ? await fetchTranscriptAndHighlights(id)
      : { transcript: null, highlights: null };

  return Response.json(buildStatusResponse(project, transcript, highlights), { status: 200 });
}

type ProjectRow = {
  id: string;
  title: string | null;
  status: string;
  error_message: string | null;
  completed_at: string | null;
  processing_log: unknown[];
  stitch_url?: string | null;
};

function buildStatusResponse(
  project: ProjectRow,
  transcript: { id: string; segments: unknown[] } | null,
  highlights: { id: string; segments: unknown[] } | null
) {
  return {
    id: project.id,
    title: project.title ?? "",
    status: project.status,
    error_message: project.error_message ?? null,
    completed_at: project.completed_at ?? null,
    processing_log: project.processing_log ?? [],
    transcript,
    highlights,
    stitch_url: project.stitch_url ?? null,
  };
}
