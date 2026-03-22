import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";

type LogEntry = { step: string; provider?: string; detail?: string; status: "ok" | "error"; ts: string };

function makeLogger() {
  const entries: LogEntry[] = [];
  return {
    log(entry: Omit<LogEntry, "ts">) {
      entries.push({ ...entry, ts: new Date().toISOString() });
    },
    getEntries() { return entries; },
  };
}

export interface ClipExportEventData {
  clipId: string;
  projectId: string;
  userId: string;
}

export async function clipExportHandler(
  event: { data: ClipExportEventData },
  step: { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> }
): Promise<Record<string, unknown>> {
  const { clipId, projectId } = event.data;
  const logger = makeLogger();

  try {
    // Step 1 — fetch clip details
    const clip = await step.run("fetch-clip", async () => {
      const { data, error } = await supabaseAdmin
        .from("clips")
        .select("id, start_sec, end_sec, caption_style, aspect_ratio, clip_title")
        .eq("id", clipId)
        .single();

      if (error || !data) throw new Error(`Clip ${clipId} not found`);
      logger.log({ step: "fetch-clip", provider: "supabase", detail: `clip ${clipId}`, status: "ok" });
      return data;
    });

    // Step 2 — render (TODO: integrate actual video renderer)
    await step.run("render-clip", async () => {
      // Stub: in a real implementation this would call a video rendering service
      // e.g., Remotion, FFmpeg cloud, or a dedicated render worker
      logger.log({
        step: "render-clip",
        provider: "stub",
        detail: `project=${projectId} start=${(clip as { start_sec: number }).start_sec}s end=${(clip as { end_sec: number }).end_sec}s`,
        status: "ok",
      });
    });

    // Step 3 — mark exported
    await step.run("finalize-export", async () => {
      await supabaseAdmin
        .from("clips")
        .update({ status: "exported" })
        .eq("id", clipId);

      logger.log({ step: "finalize-export", provider: "system", detail: `clip ${clipId} exported`, status: "ok" });
    });

    return { clipId, projectId, status: "exported", log: logger.getEntries() };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("clips")
      .update({ status: "pending" })
      .eq("id", clipId);
    return { clipId, status: "failed", error: errorMessage };
  }
}

export const clipExport = inngest.createFunction(
  { id: "clip-export", retries: 2 },
  { event: "clipcrafter/clip.export" },
  async ({ event, step }) => clipExportHandler(event as { data: ClipExportEventData }, step)
);
