import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario, Given, When, Then } from "@/test/bdd";

const mockCreate = vi.fn().mockResolvedValue({
  text: "Hello world this is a transcript",
  segments: [
    { id: 0, start: 0.0, end: 1.5, text: "Hello world" },
    { id: 1, start: 1.5, end: 3.0, text: "this is a transcript" },
  ],
});

vi.mock("groq-sdk", () => {
  class MockGroq {
    audio = {
      transcriptions: {
        create: mockCreate,
      },
    };
  }
  return { default: MockGroq };
});

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const mocked = {
    ...actual,
    createReadStream: vi.fn().mockReturnValue("mock-stream"),
    // Return a small file size so transcribeAudio takes the fast path (no chunking)
    statSync: vi.fn().mockReturnValue({ size: 1024 * 1024 }), // 1 MB — well under 24 MB limit
  };
  // groq.ts uses `import fs from "fs"` (CJS default); expose as both named and default
  return { ...mocked, default: mocked };
});

Feature("Groq transcribeAudio", () => {
  Scenario("Transcribe an audio file with Whisper", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockCreate.mockResolvedValue({
        text: "Hello world this is a transcript",
        segments: [
          { id: 0, start: 0.0, end: 1.5, text: "Hello world" },
          { id: 1, start: 1.5, end: 3.0, text: "this is a transcript" },
        ],
      });
    });

    Given("a valid audio file path", async () => {
      const { transcribeAudio } = await import("@/lib/groq");
      expect(typeof transcribeAudio).toBe("function");
    });

    When("transcribeAudio is called with a valid path", async () => {
      const { transcribeAudio } = await import("@/lib/groq");
      const result = await transcribeAudio("/tmp/audio.mp3");
      expect(result).toBeDefined();
    });

    Then("it returns transcript text and segments", async () => {
      const { transcribeAudio } = await import("@/lib/groq");
      const result = await transcribeAudio("/tmp/audio.mp3");
      expect(result.text).toBe("Hello world this is a transcript");
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]).toMatchObject({ start: 0.0, end: 1.5, text: "Hello world" });
    });

    Then("it uses whisper-large-v3 model", async () => {
      const { transcribeAudio } = await import("@/lib/groq");
      await transcribeAudio("/tmp/audio.mp3");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "whisper-large-v3" })
      );
    });
  });

  Scenario("Transcribe with missing file path", () => {
    Then("it throws an error when path is empty", async () => {
      const { transcribeAudio } = await import("@/lib/groq");
      await expect(transcribeAudio("")).rejects.toThrow("audioPath is required");
    });
  });

  Scenario("Rate limit error is re-wrapped with retry info", () => {
    Then("it throws a 'Groq rate limit' error when API returns retry-after message", async () => {
      mockCreate.mockRejectedValueOnce(
        new Error("Rate limit reached — please try again in 1m30s for this request")
      );

      const { transcribeAudio } = await import("@/lib/groq");
      await expect(transcribeAudio("/tmp/audio.mp3")).rejects.toThrow(/Groq rate limit/);
    });

    Then("it rethrows unrelated errors as-is", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network failure"));

      const { transcribeAudio } = await import("@/lib/groq");
      await expect(transcribeAudio("/tmp/audio.mp3")).rejects.toThrow("Network failure");
    });
  });
});
