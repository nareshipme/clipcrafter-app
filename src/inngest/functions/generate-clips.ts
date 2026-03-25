/**
 * Inngest function: generate clips for a project
 *
 * Pipeline (graph-first):
 *   1. fetch-transcript
 *   2. build-video-graph  ← Narrative Designer prompt, primary source of truth
 *   3. save-clips         ← derived from graph segments (not a separate LLM call)
 *
 * Manual mode (count/prompt/targetDuration set):
 *   Falls back to highlights.ts for targeted extraction, then derives graph from those clips.
 */
import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { formatSegmentsForHighlights } from "@/lib/highlights";
import type { VideoGraph } from "@/lib/video-graph";

export interface GenerateClipsEventData {
  projectId: string;
  userId: string;
  count?: number;
  prompt?: string;
  targetDuration?: number;
}

export const generateClips = inngest.createFunction(
  { id: "generate-clips", retries: 2, timeouts: { finish: "10m" } },
  { event: "clips/generate" },
  async ({ event, step }) => {
    const { projectId, count, prompt, targetDuration } = event.data as GenerateClipsEventData;
    const isManual = !!(count || prompt || targetDuration);

    await step.run("mark-generating", async () => {
      await supabaseAdmin
        .from("projects")
        .update({ clips_status: "generating" })
        .eq("id", projectId);
    });

    const transcript = await step.run("fetch-transcript", async () => {
      const { data } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (!data?.segments?.length) throw new Error("No transcript found");
      return data.segments as Array<{ start: number; end: number; text: string }>;
    });

    const formatted = formatSegmentsForHighlights(transcript);

    // ── Auto mode: graph is primary ───────────────────────────────────────────
    // ── Manual mode: highlights first, graph derived from results ─────────────
    const graph: VideoGraph = await step.run("build-video-graph", async () => {
      if (isManual) {
        // Manual: use highlights.ts for targeted extraction
        const { generateHighlights } = await import("@/lib/highlights");
        const { buildGraphFromClips } = await import("@/lib/video-graph");
        const highlights = await generateHighlights(formatted, transcript, {
          count,
          prompt,
          targetDuration,
        });
        return buildGraphFromClips(highlights);
      } else {
        // Auto: Narrative Designer builds the graph directly
        const { buildVideoGraph } = await import("@/lib/video-graph");
        return buildVideoGraph(formatted, transcript);
      }
    });

    await step.run("save-clips", async () => {
      await supabaseAdmin.from("clips").delete().eq("project_id", projectId);

      if (!graph.segments.length) {
        await supabaseAdmin
          .from("projects")
          .update({ clips_status: "failed", video_graph: null })
          .eq("id", projectId);
        return;
      }

      // Map graph segments → clips, enriching from parent node
      const insertPayload = graph.segments.map((seg) => {
        const node = graph.nodes.find((n) => n.id === seg.topicId);
        return {
          project_id: projectId,
          title: seg.hookSentence?.slice(0, 60) || node?.label || "Untitled",
          start_sec: seg.start,
          end_sec: seg.end,
          score: seg.intensityScore ?? 50,
          score_reason: null as string | null,
          hashtags: [] as string[],
          clip_title: seg.hookSentence?.slice(0, 80) || null,
          topic: node?.label ?? null,
          status: "pending",
          caption_style: "hormozi",
          aspect_ratio: "9:16",
        };
      });

      await supabaseAdmin.from("clips").insert(insertPayload);
      await supabaseAdmin
        .from("projects")
        .update({ clips_status: "done", video_graph: graph })
        .eq("id", projectId);
    });

    // Enrich clips with score_reason + hashtags in background (non-blocking, best-effort)
    await step.run("enrich-clips", async () => {
      try {
        const { enrichClipsForProject } = await import("@/lib/highlights");
        await enrichClipsForProject(projectId, graph.segments, transcript);
      } catch (err) {
        console.warn("[generate-clips] enrich step failed (non-fatal):", err);
      }
    });

    return {
      projectId,
      clipCount: graph.segments.length,
      topicCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    };
  }
);
