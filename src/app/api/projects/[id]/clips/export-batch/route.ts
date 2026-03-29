/**
 * POST /api/projects/[id]/clips/export-batch — queue multiple clip exports
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";
import { inngest } from "@/lib/inngest";

const EXPORTABLE_STATUSES = ["pending", "approved"] as const;

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

function validateExportBatchBody(body: {
  clipIds?: unknown;
  withCaptions?: unknown;
  captions?: unknown;
}): string | null {
  if (!Array.isArray(body.clipIds) || body.clipIds.length === 0) {
    return "clipIds must be a non-empty array";
  }
  return null;
}

function resolveEligibleClipIds(clips: { id: string; status: string }[]): {
  validIds: string[];
  skippedCount: number;
} {
  const eligible = clips.filter((c) =>
    (EXPORTABLE_STATUSES as readonly string[]).includes(c.status)
  );
  return { validIds: eligible.map((c) => c.id), skippedCount: clips.length - eligible.length };
}

function checkNothingToQueue(
  validIds: string[],
  foundClips: { id: string; status: string }[]
): Response | null {
  if (foundClips.length === 0) {
    return Response.json({ error: "No valid clip IDs for this project" }, { status: 400 });
  }
  if (validIds.length === 0) {
    return Response.json(
      {
        error: "All selected clips are already exported or exporting",
        queued: 0,
        skipped: foundClips.length,
      },
      { status: 409 }
    );
  }
  return null;
}

interface DispatchOpts {
  validIds: string[];
  projectId: string;
  supabaseUserId: string;
  withCaptions: boolean;
  captions?: CaptionSegment[];
}

async function dispatchExportEvents(opts: DispatchOpts) {
  const { validIds, projectId, supabaseUserId, withCaptions, captions } = opts;
  await supabaseAdmin.from("clips").update({ status: "exporting" }).in("id", validIds);
  await Promise.all(
    validIds.map((clipId) =>
      inngest.send({
        name: "clipcrafter/clip.export",
        data: { clipId, projectId, userId: supabaseUserId, withCaptions, customCaptions: captions },
      })
    )
  );
}

function resolveCustomCaptions(raw: unknown): CaptionSegment[] | undefined {
  return Array.isArray(raw) ? (raw as CaptionSegment[]) : undefined;
}

async function resolveAuthedUser(): Promise<{ supabaseUserId: string } | { error: Response }> {
  const { userId } = await auth();
  if (!userId) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId)
    return { error: Response.json({ error: "Failed to resolve user" }, { status: 500 }) };
  return { supabaseUserId };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authed = await resolveAuthedUser();
  if ("error" in authed) return authed.error;
  const { supabaseUserId } = authed;

  const { id: projectId } = await params;
  const body = (await request.json()) as {
    clipIds?: unknown;
    withCaptions?: unknown;
    captions?: unknown;
  };
  const { clipIds, withCaptions, captions } = body;

  const validationError = validateExportBatchBody(body);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  // Verify project ownership and load clips in parallel
  const [{ data: project, error: projError }, { data: clips, error: clipsError }] =
    await Promise.all([
      supabaseAdmin.from("projects").select("id, user_id").eq("id", projectId).single(),
      supabaseAdmin
        .from("clips")
        .select("id, status")
        .eq("project_id", projectId)
        .in("id", clipIds as string[]),
    ]);

  if (projError || !project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.user_id !== supabaseUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (clipsError) return Response.json({ error: clipsError.message }, { status: 500 });

  // Only queue clips that are pending or approved — skip already exporting/exported ones
  const { validIds, skippedCount } = resolveEligibleClipIds(clips ?? []);
  const nothingToQueue = checkNothingToQueue(validIds, clips ?? []);
  if (nothingToQueue) return nothingToQueue;

  await dispatchExportEvents({
    validIds,
    projectId,
    supabaseUserId,
    withCaptions: withCaptions === true,
    captions: resolveCustomCaptions(captions),
  });

  return Response.json({ queued: validIds.length, skipped: skippedCount }, { status: 202 });
}
