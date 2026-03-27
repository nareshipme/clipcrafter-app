import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

// Mock @/lib/llm — all highlights paths go through callLLM
const mockCallLLM = vi.fn();
vi.mock("@/lib/llm", () => ({
  callLLM: mockCallLLM,
  parseLLMJson: (raw: string) => {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  },
}));

const baseHighlight = {
  start: 10,
  end: 40,
  text: "This is the most impactful quote",
  reason: "Strong emotional hook",
  score: 85,
  score_reason: "High hook strength and quotability",
  hashtags: ["#motivation", "#mindset", "#growth"],
  clip_title: "The Key to Massive Success",
  topic: "motivation",
};

// For auto-mode (no opts.count), generateHighlights calls:
//   1. callLLM for buildTopicMap  → returns TopicMap JSON
//   2. callLLM for enrichClips    → returns enrichment JSON
function makeTopicMapResponse(h: typeof baseHighlight) {
  return JSON.stringify([
    {
      topic: h.topic ?? "motivation",
      summary: "Key motivational moment",
      clip_start: "00:10",
      clip_end: "00:40",
      segments: [{ start: "00:10", end: "00:40", text: h.text }],
    },
  ]);
}

function makeEnrichResponse(h: typeof baseHighlight) {
  return JSON.stringify([
    {
      score: h.score,
      score_reason: h.score_reason,
      reason: h.reason,
      hashtags: h.hashtags,
      clip_title: h.clip_title,
    },
  ]);
}

Feature("generateHighlights — Highlight interface", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("Auto mode returns highlights with score, hashtags, clip_title", () => {
    it("Given a transcript, Then Highlight objects include score, hashtags, clip_title", async () => {
      // Auto mode: two callLLM calls — topic map then enrichment
      mockCallLLM
        .mockResolvedValueOnce(makeTopicMapResponse(baseHighlight))
        .mockResolvedValueOnce(makeEnrichResponse(baseHighlight));

      const { generateHighlights } = await import("@/lib/highlights");
      const results = await generateHighlights("[00:10] This is the most impactful quote");

      expect(results).toHaveLength(1);
      const h = results[0];
      expect(h.start).toBe(10);
      expect(h.end).toBe(40);
      expect(typeof h.score).toBe("number");
      expect(h.score).toBe(85);
      expect(h.score_reason).toBe("High hook strength and quotability");
      expect(Array.isArray(h.hashtags)).toBe(true);
      expect(h.hashtags).toHaveLength(3);
      expect(typeof h.clip_title).toBe("string");
      expect(h.clip_title).toBe("The Key to Massive Success");
    });
  });

  Scenario("Highlight score can be 0", () => {
    it("Given a highlight with score 0, Then it is parsed correctly", async () => {
      const zeroHighlight = {
        ...baseHighlight,
        score: 0,
        score_reason: "no hook",
        reason: "low energy",
        hashtags: ["#test"],
        clip_title: "Low Energy Moment",
        text: "meh",
        start: 0,
        end: 5,
      };

      mockCallLLM
        .mockResolvedValueOnce(makeTopicMapResponse(zeroHighlight))
        .mockResolvedValueOnce(makeEnrichResponse(zeroHighlight));

      const { generateHighlights } = await import("@/lib/highlights");
      const results = await generateHighlights("[00:00] meh content");

      expect(results[0].score).toBe(0);
    });
  });

  Scenario("empty transcript throws", () => {
    it("Given empty transcript, Then throws an error", async () => {
      const { generateHighlights } = await import("@/lib/highlights");
      await expect(generateHighlights("")).rejects.toThrow("transcript is required");
    });
  });

  Scenario("formatSegmentsForHighlights formats timestamps correctly", () => {
    it("Given segments array, Then each line is prefixed with [MM:SS]", async () => {
      const { formatSegmentsForHighlights } = await import("@/lib/highlights");
      const segments = [
        { start: 0, end: 10, text: "Hello world" },
        { start: 65, end: 75, text: "One minute five seconds" },
      ];
      const result = formatSegmentsForHighlights(segments);
      expect(result).toContain("[00:00] Hello world");
      expect(result).toContain("[01:05] One minute five seconds");
    });
  });

  Scenario("thinTranscript trims long transcripts", () => {
    it("Given a transcript under 15K chars, Then it is returned unchanged", async () => {
      const { thinTranscript } = await import("@/lib/highlights");
      const short = "short text";
      expect(thinTranscript(short)).toBe(short);
    });

    it("Given a very long transcript, Then it is trimmed to maxChars", async () => {
      const { thinTranscript } = await import("@/lib/highlights");
      const long = Array.from({ length: 2000 }, (_, i) => `[${i}:00] word`).join("\n");
      const result = thinTranscript(long);
      expect(result.length).toBeLessThanOrEqual(15_000);
    });
  });
});
