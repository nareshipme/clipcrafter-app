import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario, Given, When, Then, And } from "@/test/bdd";

// --- Supabase mock ---
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: { id: "transcript-abc" }, error: null });
const mockInsertHighlight = vi.fn().mockReturnThis();
const mockSingleHighlight = vi
  .fn()
  .mockResolvedValue({ data: { id: "highlight-xyz" }, error: null });

const supabaseChain = {
  update: mockUpdate,
  eq: mockEq,
  insert: mockInsert,
  select: mockSelect,
  single: mockSingle,
};

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "highlights") {
        return {
          insert: mockInsertHighlight,
          select: vi.fn().mockReturnThis(),
          single: mockSingleHighlight,
        };
      }
      return supabaseChain;
    }),
  },
}));

// --- R2 / AWS SDK mock ---
const mockR2Send = vi.fn().mockResolvedValue({
  Body: {
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from("fake-video-data");
    },
  },
});

vi.mock("@/lib/r2", () => ({
  r2Client: { send: mockR2Send },
  R2_BUCKET: "test-bucket",
}));

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: vi.fn().mockImplementation((params) => ({ ...params, __type: "GetObject" })),
}));

// --- fs mock ---
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);
const mockCreateReadStream = vi.fn().mockReturnValue("mock-stream");

vi.mock("fs/promises", () => ({
  default: { writeFile: mockWriteFile, unlink: mockUnlink },
  writeFile: mockWriteFile,
  unlink: mockUnlink,
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    createReadStream: mockCreateReadStream,
  };
});

// --- fluent-ffmpeg mock ---
const mockFfmpegRun = vi.fn();
const mockFfmpegOn = vi.fn();
const mockFfmpegNoVideo = vi.fn().mockReturnThis();
const mockFfmpegAudioCodec = vi.fn().mockReturnThis();
const mockFfmpegOutput = vi.fn().mockReturnThis();

vi.mock("fluent-ffmpeg", () => {
  const ffmpegFn = vi.fn().mockReturnValue({
    output: mockFfmpegOutput,
    audioCodec: mockFfmpegAudioCodec,
    noVideo: mockFfmpegNoVideo,
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === "end") setTimeout(() => cb(), 0);
      return {
        output: mockFfmpegOutput,
        audioCodec: mockFfmpegAudioCodec,
        noVideo: mockFfmpegNoVideo,
        on: vi.fn((event2: string, cb2: (...args: unknown[]) => void) => {
          if (event2 === "end") setTimeout(() => cb2(), 0);
          return { run: mockFfmpegRun };
        }),
        run: mockFfmpegRun,
      };
    }),
    run: mockFfmpegRun,
  });
  return { default: ffmpegFn };
});

// --- Groq mock ---
const mockTranscribeAudio = vi.fn().mockResolvedValue({
  text: "Hello this is a test transcript.",
  segments: [{ id: 0, start: 0, end: 3, text: "Hello this is a test transcript." }],
});

vi.mock("@/lib/groq", () => ({
  transcribeAudio: mockTranscribeAudio,
}));

// --- Gemini mock ---
const mockGenerateHighlights = vi.fn().mockResolvedValue([
  { start: 0, end: 3, text: "Hello this is a test transcript.", reason: "Opening statement" },
]);

vi.mock("@/lib/gemini", () => ({
  generateHighlights: mockGenerateHighlights,
}));

// --- os mock ---
vi.mock("os", () => ({
  default: { tmpdir: vi.fn().mockReturnValue("/tmp") },
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

// -------------------------------------------------------

function makeMockStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

function makeMockEvent(overrides: Partial<{ projectId: string; r2Key: string; userId: string }> = {}) {
  return {
    data: {
      projectId: "project-123",
      r2Key: "uploads/user/video.mp4",
      userId: "user-abc",
      ...overrides,
    },
  };
}

Feature("processVideo Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockR2Send.mockResolvedValue({
      Body: {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("fake-video-data");
        },
      },
    });
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockTranscribeAudio.mockResolvedValue({
      text: "Hello this is a test transcript.",
      segments: [{ id: 0, start: 0, end: 3, text: "Hello this is a test transcript." }],
    });
    mockGenerateHighlights.mockResolvedValue([
      { start: 0, end: 3, text: "Hello this is a test transcript.", reason: "Opening" },
    ]);
    mockUpdate.mockReturnThis();
    mockEq.mockResolvedValue({ error: null });
    mockInsert.mockReturnThis();
    mockSelect.mockReturnThis();
    mockSingle.mockResolvedValue({ data: { id: "transcript-abc" }, error: null });
    mockInsertHighlight.mockReturnThis();
    mockSingleHighlight.mockResolvedValue({ data: { id: "highlight-xyz" }, error: null });
  });

  Scenario("Step 1: download-from-r2", () => {
    Given("a video/process event with projectId, r2Key, userId", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      expect(typeof processVideo).toBe("object");
    });

    When("the function runs step download-from-r2", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });
      expect(step.run).toHaveBeenCalledWith("download-from-r2", expect.any(Function));
    });

    Then("it downloads from R2 and updates project status to processing", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockR2Send).toHaveBeenCalled();

      const { supabaseAdmin } = await import("@/lib/supabase");
      expect(supabaseAdmin.from).toHaveBeenCalledWith("projects");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "processing" }));
    });
  });

  Scenario("Step 2: extract-audio", () => {
    When("the function runs step extract-audio", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });
      expect(step.run).toHaveBeenCalledWith("extract-audio", expect.any(Function));
    });

    Then("it updates project status to extracting_audio", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "extracting_audio" })
      );
    });
  });

  Scenario("Step 3: transcribe", () => {
    When("the function runs step transcribe", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });
      expect(step.run).toHaveBeenCalledWith("transcribe", expect.any(Function));
    });

    Then("it calls transcribeAudio and saves to transcripts table", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockTranscribeAudio).toHaveBeenCalled();
      const { supabaseAdmin } = await import("@/lib/supabase");
      expect(supabaseAdmin.from).toHaveBeenCalledWith("transcripts");
    });

    And("it updates project status to transcribing", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "transcribing" })
      );
    });
  });

  Scenario("Step 4: generate-highlights", () => {
    When("the function runs step generate-highlights", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });
      expect(step.run).toHaveBeenCalledWith("generate-highlights", expect.any(Function));
    });

    Then("it calls generateHighlights and saves to highlights table", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockGenerateHighlights).toHaveBeenCalledWith("Hello this is a test transcript.");
      const { supabaseAdmin } = await import("@/lib/supabase");
      expect(supabaseAdmin.from).toHaveBeenCalledWith("highlights");
    });

    And("it updates project status to generating_highlights", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "generating_highlights" })
      );
    });
  });

  Scenario("Step 5: finalize", () => {
    When("the function runs step finalize", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });
      expect(step.run).toHaveBeenCalledWith("finalize", expect.any(Function));
    });

    Then("it updates project status to completed", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
    });

    And("it returns projectId, status, transcriptId, highlightId", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      const result = await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(result).toMatchObject({
        projectId: "project-123",
        status: "completed",
        transcriptId: "transcript-abc",
        highlightId: "highlight-xyz",
      });
    });
  });

  Scenario("Error handling", () => {
    Given("R2 download fails", async () => {
      mockR2Send.mockRejectedValue(new Error("R2 connection failed"));
    });

    Then("it sets project status to failed with error_message", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();

      await (processVideo as unknown as { fn: (ctx: { event: typeof event; step: typeof step }) => Promise<unknown> }).fn({ event, step });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          error_message: expect.any(String),
        })
      );
    });
  });
});
