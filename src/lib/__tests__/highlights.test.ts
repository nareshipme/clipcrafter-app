import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

// Mock fetch globally for Sarvam tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mutable reference so individual tests can change the response
const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

const baseHighlight = {
  start: 10,
  end: 40,
  text: "This is the most impactful quote",
  reason: "Strong emotional hook",
  score: 85,
  score_reason: "High hook strength and quotability",
  hashtags: ["#motivation", "#mindset", "#growth"],
  clip_title: "The Key to Massive Success",
};

Feature("generateHighlights — updated Highlight interface", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  Scenario("Gemini returns highlights with score, hashtags, clip_title", () => {
    it("Given a transcript, Then Highlight objects include score, hashtags, clip_title", async () => {
      vi.stubEnv("HIGHLIGHTS_PROVIDER", "gemini");
      vi.stubEnv("GEMINI_API_KEY", "test-key");
      vi.stubEnv("GEMINI_MODEL", "gemini-test-model");

      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => JSON.stringify([baseHighlight]) },
      });

      const { generateHighlights } = await import("@/lib/highlights");
      const results = await generateHighlights("some long transcript text here");

      expect(results).toHaveLength(1);
      const h = results[0];
      expect(h.start).toBe(10);
      expect(h.end).toBe(40);
      expect(h.text).toBe("This is the most impactful quote");
      expect(h.reason).toBe("Strong emotional hook");
      expect(typeof h.score).toBe("number");
      expect(h.score).toBe(85);
      expect(h.score_reason).toBe("High hook strength and quotability");
      expect(Array.isArray(h.hashtags)).toBe(true);
      expect(h.hashtags).toHaveLength(3);
      expect(typeof h.clip_title).toBe("string");
      expect(h.clip_title).toBe("The Key to Massive Success");
    });
  });

  Scenario("Sarvam returns highlights with score, hashtags, clip_title", () => {
    it("Given Sarvam provider, Then Highlight objects include all new fields", async () => {
      vi.stubEnv("HIGHLIGHTS_PROVIDER", "sarvam");
      vi.stubEnv("SARVAM_API_KEY", "test-sarvam-key");
      vi.stubEnv("SARVAM_LLM_MODEL", "sarvam-m");

      const highlight = {
        start: 5,
        end: 30,
        text: "You have to go all in",
        reason: "Actionable and direct",
        score: 72,
        score_reason: "Strong actionability and hook",
        hashtags: ["#hustle", "#success", "#mindset"],
        clip_title: "Go All In or Go Home",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([highlight]) } }],
        }),
      });

      const { generateHighlights } = await import("@/lib/highlights");
      const results = await generateHighlights("You have to go all in on your dreams");

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(72);
      expect(results[0].score_reason).toBe("Strong actionability and hook");
      expect(results[0].hashtags).toEqual(["#hustle", "#success", "#mindset"]);
      expect(results[0].clip_title).toBe("Go All In or Go Home");
    });
  });

  Scenario("Highlight score can be 0", () => {
    it("Given a highlight with score 0, Then it is parsed correctly", async () => {
      vi.stubEnv("HIGHLIGHTS_PROVIDER", "gemini");
      vi.stubEnv("GEMINI_API_KEY", "test-key");
      vi.stubEnv("GEMINI_MODEL", "gemini-test-model");

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify([
              {
                start: 0,
                end: 5,
                text: "meh",
                reason: "low energy",
                score: 0,
                score_reason: "no hook",
                hashtags: ["#test"],
                clip_title: "Low Energy Moment",
              },
            ]),
        },
      });

      const { generateHighlights } = await import("@/lib/highlights");
      const results = await generateHighlights("meh content");
      expect(results[0].score).toBe(0);
    });
  });

  Scenario("empty transcript throws", () => {
    it("Given empty transcript, Then throws an error", async () => {
      const { generateHighlights } = await import("@/lib/highlights");
      await expect(generateHighlights("")).rejects.toThrow("transcript is required");
    });
  });
});
