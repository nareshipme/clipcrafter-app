import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario, Given, When, Then, And } from "@/test/bdd";

// --- Supabase mock ---
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

const mockSingle = vi.fn().mockResolvedValue({ data: { id: "transcript-abc" }, error: null });
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

const mockSingleHighlight = vi
  .fn()
  .mockResolvedValue({ data: { id: "highlight-xyz" }, error: null });
const mockSelectHighlight = vi.fn().mockReturnValue({ single: mockSingleHighlight });
const mockInsertHighlight = vi.fn().mockReturnValue({ select: mockSelectHighlight });

// Initial project select: returns r2_key so the handler can proceed
const mockProjectSingle = vi.fn().mockResolvedValue({
  data: { status: "pending", audio_key: null, r2_key: "uploads/user/video.mp4" },
  error: null,
});
const mockProjectEq = vi.fn().mockReturnValue({ single: mockProjectSingle });
const mockProjectSelect = vi.fn().mockReturnValue({ eq: mockProjectEq });

const mockFrom = vi.fn((table: string) => {
  if (table === "highlights") {
    return { insert: mockInsertHighlight };
  }
  if (table === "transcripts") {
    return { update: mockUpdate, insert: mockInsert };
  }
  // "projects" — has both select (initial read) and update
  return { update: mockUpdate, insert: mockInsert, select: mockProjectSelect };
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
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
  GetObjectCommand: class {
    constructor(public params: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public params: unknown) {}
  },
}));

// --- fs mock ---
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue(Buffer.from("fake-audio-data"));

vi.mock("fs/promises", () => ({
  default: { writeFile: mockWriteFile, unlink: mockUnlink, readFile: mockReadFile },
  writeFile: mockWriteFile,
  unlink: mockUnlink,
  readFile: mockReadFile,
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

// --- fluent-ffmpeg mock ---
vi.mock("fluent-ffmpeg", () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const run = vi.fn();
  const on = vi.fn((event: string, cb: () => void) => {
    if (event === "end") cb();
    return chain;
  });
  const noVideo = vi.fn().mockReturnValue({ on, run });
  const audioCodec = vi.fn().mockReturnValue({ noVideo });
  const output = vi.fn().mockReturnValue({ audioCodec });
  Object.assign(chain, { output, audioCodec, noVideo, on, run });
  return { default: vi.fn().mockReturnValue({ output }) };
});

// --- Transcribe mock (@/lib/transcribe, not @/lib/groq) ---
const mockTranscribeAudio = vi.fn().mockResolvedValue({
  text: "Hello this is a test transcript.",
  segments: [{ id: 0, start: 0, end: 3, text: "Hello this is a test transcript." }],
  provider: "Sarvam Saaras v3",
});

vi.mock("@/lib/transcribe", () => ({
  transcribeAudio: mockTranscribeAudio,
}));

// --- Highlights mock (@/lib/highlights, not @/lib/gemini) ---
const mockGenerateHighlights = vi.fn().mockResolvedValue([
  {
    start: 0,
    end: 3,
    text: "Hello this is a test transcript.",
    reason: "Opening statement",
    score: 75,
    score_reason: "Good hook",
    hashtags: ["#test"],
    clip_title: "Opening",
  },
]);

vi.mock("@/lib/highlights", () => ({
  generateHighlights: mockGenerateHighlights,
  formatSegmentsForHighlights: vi.fn().mockReturnValue("[00:00] Hello this is a test transcript."),
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

function makeMockEvent(
  overrides: Partial<{ projectId: string; r2Key: string; userId: string }> = {}
) {
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

    mockProjectSingle.mockResolvedValue({
      data: { status: "pending", audio_key: null, r2_key: "uploads/user/video.mp4" },
      error: null,
    });
    mockProjectEq.mockReturnValue({ single: mockProjectSingle });
    mockProjectSelect.mockReturnValue({ eq: mockProjectEq });

    mockR2Send.mockResolvedValue({
      Body: {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from("fake-video-data");
        },
      },
    });
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("fake-audio-data"));
    mockUnlink.mockResolvedValue(undefined);
    mockTranscribeAudio.mockResolvedValue({
      text: "Hello this is a test transcript.",
      segments: [{ id: 0, start: 0, end: 3, text: "Hello this is a test transcript." }],
      provider: "Sarvam Saaras v3",
    });
    mockGenerateHighlights.mockResolvedValue([
      {
        start: 0,
        end: 3,
        text: "Hello this is a test transcript.",
        reason: "Opening",
        score: 75,
        score_reason: "Good hook",
        hashtags: ["#test"],
        clip_title: "Opening",
      },
    ]);
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: { id: "transcript-abc" }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSingleHighlight.mockResolvedValue({ data: { id: "highlight-xyz" }, error: null });
    mockSelectHighlight.mockReturnValue({ single: mockSingleHighlight });
    mockInsertHighlight.mockReturnValue({ select: mockSelectHighlight });
    mockFrom.mockImplementation((table: string) => {
      if (table === "highlights") return { insert: mockInsertHighlight };
      if (table === "transcripts") return { update: mockUpdate, insert: mockInsert };
      return { update: mockUpdate, insert: mockInsert, select: mockProjectSelect };
    });
  });

  Scenario("Step 1: download-from-r2", () => {
    Given("a video/process event with projectId, r2Key, userId", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      expect(typeof processVideoHandler).toBe("function");
    });

    When("the function runs step download-from-r2", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);
      expect(step.run).toHaveBeenCalledWith("download-from-r2", expect.any(Function));
    });

    Then("it downloads from R2 and updates project status to processing", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockR2Send).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith("projects");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "processing" }));
    });
  });

  Scenario("Step 2: extract-audio", () => {
    When("the function runs step extract-audio", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);
      expect(step.run).toHaveBeenCalledWith("extract-audio", expect.any(Function));
    });

    Then("it updates project status to extracting_audio", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "extracting_audio" })
      );
    });
  });

  Scenario("Step 3: transcribe", () => {
    When("the function runs step transcribe", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);
      expect(step.run).toHaveBeenCalledWith("transcribe", expect.any(Function));
    });

    Then("it calls transcribeAudio and saves to transcripts table", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockTranscribeAudio).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith("transcripts");
    });

    And("it updates project status to transcribing", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "transcribing" }));
    });
  });

  Scenario("Step 4: generate-highlights", () => {
    When("the function runs step generate-highlights", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);
      expect(step.run).toHaveBeenCalledWith("generate-highlights", expect.any(Function));
    });

    Then("it calls generateHighlights and saves to highlights table", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockGenerateHighlights).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith("highlights");
    });

    And("it updates project status to generating_highlights", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "generating_highlights" })
      );
    });
  });

  Scenario("Step 5: finalize", () => {
    When("the function runs step finalize", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);
      expect(step.run).toHaveBeenCalledWith("finalize", expect.any(Function));
    });

    Then("it updates project status to completed", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      await processVideoHandler(event, step);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    });

    And("it returns projectId, status, transcriptId, highlightId", async () => {
      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();
      const result = await processVideoHandler(event, step);

      expect(result).toMatchObject({
        projectId: "project-123",
        status: "completed",
        transcriptId: "transcript-abc",
        highlightId: "highlight-xyz",
      });
    });
  });

  Scenario("Error handling", () => {
    Then("it sets status to failed with error_message when project has no r2_key", async () => {
      mockProjectSingle.mockResolvedValue({
        data: { status: "pending", audio_key: null, r2_key: "" },
        error: null,
      });

      const { processVideoHandler } = await import("@/inngest/functions/process-video");
      const step = makeMockStep();
      const event = makeMockEvent();

      await processVideoHandler(event, step);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          error_message: expect.any(String),
        })
      );
    });
  });
});
