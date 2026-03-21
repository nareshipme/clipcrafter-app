import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario, Given, When, Then } from "@/test/bdd";

const mockHighlights = [
  { start: 0, end: 10, text: "Amazing intro moment", reason: "High energy opening" },
  { start: 30, end: 45, text: "Key insight revealed", reason: "Educational value" },
  { start: 60, end: 75, text: "Funny anecdote", reason: "Audience engagement" },
  { start: 90, end: 100, text: "Surprising statistic", reason: "Shock value" },
  { start: 120, end: 135, text: "Powerful conclusion", reason: "Strong call to action" },
];

const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () => JSON.stringify(mockHighlights),
  },
});

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

Feature("Gemini generateHighlights", () => {
  Scenario("Generate highlights from transcript text", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockHighlights),
        },
      });
    });

    Given("a valid transcript text", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      expect(typeof generateHighlights).toBe("function");
    });

    When("generateHighlights is called with transcript text", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      const result = await generateHighlights("This is a sample transcript.");
      expect(result).toBeDefined();
    });

    Then("it returns an array of 5 highlight segments", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      const result = await generateHighlights("This is a sample transcript.");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(5);
    });

    Then("each highlight has start, end, text, and reason fields", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      const result = await generateHighlights("This is a sample transcript.");
      expect(result[0]).toMatchObject({
        start: expect.any(Number),
        end: expect.any(Number),
        text: expect.any(String),
        reason: expect.any(String),
      });
    });

    Then("it calls the Gemini API with the transcript", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      await generateHighlights("This is a sample transcript.");
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining("This is a sample transcript.")
      );
    });
  });

  Scenario("Handle Gemini response with JSON wrapped in markdown", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => `\`\`\`json\n${JSON.stringify(mockHighlights)}\n\`\`\``,
        },
      });
    });

    Then("it strips markdown fences and parses JSON correctly", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      const result = await generateHighlights("Sample transcript.");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(5);
    });
  });

  Scenario("Validate inputs", () => {
    Then("it throws when transcript text is empty", async () => {
      const { generateHighlights } = await import("@/lib/gemini");
      await expect(generateHighlights("")).rejects.toThrow("transcript is required");
    });
  });
});
