/**
 * VideoGraphService — Semantic graph from transcript.
 *
 * Uses callLLM() — provider-agnostic. Change LLM_PROVIDER/LLM_MODEL env vars
 * to switch between Gemini, GPT-4o, Claude, Sarvam, OpenRouter, etc.
 *
 * Output: VideoGraph JSON
 *   Nodes    = Topics the speaker covers
 *   Segments = Short-form clips within each topic (high viral potential)
 *   Edges    = Semantic flow between segments (setup→payoff, claim→proof, etc.)
 */

import { callLLM, parseLLMJson } from "@/lib/llm";
import { TranscriptSegmentInput } from "@/lib/highlights";

export interface GraphNode {
  id: string;
  label: string;
  summary: string;
  importance: number; // 0-100
  speakerId: string | null;
}

export interface GraphSegment {
  id: string;
  topicId: string;
  start: number; // seconds
  end: number;
  hookSentence: string; // first punchy sentence for preview
  intensityScore: number; // 0-100 viral potential
}

export interface GraphEdge {
  source: string; // segment id
  target: string; // segment id
  relationshipType:
    | "logical-flow"
    | "contrast"
    | "setup-payoff"
    | "claim-proof"
    | "problem-solution";
  emotionalArc?: string; // e.g. "tension → release"
}

export interface VideoGraph {
  nodes: GraphNode[];
  segments: GraphSegment[];
  edges: GraphEdge[];
}

const VIDEO_GRAPH_PROMPT = (
  transcript: string
) => `You are a Narrative Designer and viral content strategist.

Analyze this timestamped transcript and build a semantic graph of the content.

Transcript ([MM:SS] text):
${transcript}

Your task:
1. GROUP segments into "Topics" (Nodes) — distinct themes the speaker covers.
2. Within each topic, identify "Clips" (Segments) with high viral/reel potential.
   A great clip has: a strong hook, emotional punch, or delivers one clear idea in 30-90s.
3. Define "Flow" (Edges) between clips:
   - If clip A sets up a question that clip B answers → "setup-payoff"
   - If clip A makes a claim that clip B proves → "claim-proof"
   - If clip A and B present opposing views → "contrast"
   - If clip A naturally leads into clip B → "logical-flow"
   - If clip A raises a problem that clip B solves → "problem-solution"

Return ONLY valid JSON matching this exact schema (no markdown):
{
  "nodes": [
    {
      "id": "t1",
      "label": "3-5 word topic name",
      "summary": "One sentence summary of this topic",
      "importance": 85,
      "speakerId": "Speaker 0"
    }
  ],
  "segments": [
    {
      "id": "s1",
      "topicId": "t1",
      "start": "MM:SS",
      "end": "MM:SS",
      "hookSentence": "The opening sentence of this clip that hooks the viewer",
      "intensityScore": 78
    }
  ],
  "edges": [
    {
      "source": "s1",
      "target": "s2",
      "relationshipType": "setup-payoff",
      "emotionalArc": "question → answer"
    }
  ]
}

Rules:
- Use ONLY timestamps that appear in the transcript
- Each segment must be 20-120 seconds long
- intensityScore: 0-100 based on hook strength, emotional punch, quotability
- importance: 0-100 based on how central this topic is to the overall narrative
- speakerId: use the [Speaker N] tags from the transcript, or null if mixed/unclear
- Only create edges where there is a genuine semantic relationship
- Aim for 3-8 topics, 1-3 segments per topic`;

/**
 * Build a VideoGraph directly from highlights/clips — no extra LLM call.
 * This ensures list view and graph view show the SAME clips with the same timestamps.
 * Edges are inferred by time order within each topic.
 */
export function buildGraphFromClips(
  clips: Array<{
    start: number;
    end: number;
    text: string;
    topic?: string;
    clip_title?: string;
    score?: number;
    reason?: string;
  }>
): VideoGraph {
  // Group by topic
  const topicGroups = new Map<string, typeof clips>();
  for (const clip of clips) {
    const t = clip.topic ?? "General";
    if (!topicGroups.has(t)) topicGroups.set(t, []);
    topicGroups.get(t)!.push(clip);
  }

  const nodes: GraphNode[] = [];
  const segments: GraphSegment[] = [];
  const edges: GraphEdge[] = [];

  let nodeIdx = 0;
  let segIdx = 0;

  for (const [topic, topicClips] of topicGroups) {
    const nodeId = `t${nodeIdx++}`;
    nodes.push({
      id: nodeId,
      label: topic,
      summary: topicClips[0]?.reason ?? topic,
      importance: Math.round(
        topicClips.reduce((s, c) => s + (c.score ?? 50), 0) / topicClips.length
      ),
      speakerId: null,
    });

    const segIds: string[] = [];
    for (const clip of topicClips.sort((a, b) => a.start - b.start)) {
      const segId = `s${segIdx++}`;
      segIds.push(segId);
      segments.push({
        id: segId,
        topicId: nodeId,
        start: clip.start,
        end: clip.end,
        hookSentence: clip.clip_title ?? clip.text?.slice(0, 100) ?? "",
        intensityScore: clip.score ?? 50,
      });
    }

    // Infer logical-flow edges between consecutive clips in same topic
    for (let i = 0; i < segIds.length - 1; i++) {
      edges.push({
        source: segIds[i],
        target: segIds[i + 1],
        relationshipType: "logical-flow",
      });
    }
  }

  return { nodes, segments, edges };
}

/** Parse "MM:SS" → seconds */
function parseMMSS(str: string): number {
  if (typeof str === "number") return str;
  const parts = String(str).trim().split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export async function buildVideoGraph(
  formattedTranscript: string,
  _rawSegments?: TranscriptSegmentInput[]
): Promise<VideoGraph> {
  console.log("[video-graph] Building semantic graph...");
  const raw = await callLLM(VIDEO_GRAPH_PROMPT(formattedTranscript), {
    temperature: 0.2,
    systemPrompt: "You are a Narrative Designer. Output only valid JSON.",
  });

  const parsed = parseLLMJson<{
    nodes: Array<{
      id: string;
      label: string;
      summary: string;
      importance: number;
      speakerId: string | null;
    }>;
    segments: Array<{
      id: string;
      topicId: string;
      start: string;
      end: string;
      hookSentence: string;
      intensityScore: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationshipType: GraphEdge["relationshipType"];
      emotionalArc?: string;
    }>;
  }>(raw);

  // Normalise: convert MM:SS strings → numbers on segments
  const graph: VideoGraph = {
    nodes: parsed.nodes ?? [],
    segments: (parsed.segments ?? [])
      .map((s) => ({
        ...s,
        start: parseMMSS(s.start),
        end: parseMMSS(s.end),
      }))
      .filter((s) => !isNaN(s.start) && !isNaN(s.end) && s.end > s.start),
    edges: parsed.edges ?? [],
  };

  console.log(
    `[video-graph] ${graph.nodes.length} topics, ${graph.segments.length} segments, ${graph.edges.length} edges`
  );
  return graph;
}
