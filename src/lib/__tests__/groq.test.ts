import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario, Given, When, Then } from "@/test/bdd";

vi.mock("groq-sdk", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    text: "Hello world this is a transcript",
    segments: [
      { id: 0, start: 0.0, end: 1.5, text: "Hello world" },
      { id: 1, start: 1.5, end: 3.0, text: "this is a transcript" },
    ],
  });
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  };
});

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    createReadStream: vi.fn().mockReturnValue("mock-stream"),
  };
});

Feature("Groq transcribeAudio", () => {
  Scenario("Transcribe an audio file with Whisper", () => {
    beforeEach(() => {
      vi.clearAllMocks();
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
      const groqSdk = await import("groq-sdk");
      const GroqClass = (groqSdk as unknown as { default: ReturnType<typeof vi.fn> }).default;
      const mockInstance = GroqClass.mock.results[0]?.value ?? GroqClass();
      const createFn = mockInstance.audio.transcriptions.create;

      const { transcribeAudio } = await import("@/lib/groq");
      await transcribeAudio("/tmp/audio.mp3");

      expect(createFn).toHaveBeenCalledWith(
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
});
