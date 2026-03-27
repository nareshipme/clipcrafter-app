import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

// --- Supabase mock ---
const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

// --- R2 / AWS SDK mock ---
const mockR2Send = vi.fn();
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

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://r2.example/stitched.mp4"),
}));

// --- fs/promises mock (needs both default and named exports for CJS interop) ---
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue(Buffer.from("fake-mp4"));
const mockUnlink = vi.fn().mockResolvedValue(undefined);

vi.mock("fs/promises", () => ({
  default: { writeFile: mockWriteFile, readFile: mockReadFile, unlink: mockUnlink },
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  unlink: mockUnlink,
}));

// --- child_process mock (needs default + named exports for CJS interop) ---
const execFileMock = vi.fn(
  (_cmd: unknown, _args: unknown, _opts: unknown, cb: (...a: unknown[]) => void) => {
    cb(null, "", "");
  }
);

vi.mock("child_process", () => ({
  default: { execFile: execFileMock },
  execFile: execFileMock,
}));

// --- inngest mock ---
vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _event: unknown, handler: unknown) => handler),
  },
}));

const makeStep = () => ({
  run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
});

const makeEvent = (data: object = {}) => ({
  id: "evt-test-123",
  data: {
    projectId: "proj_1",
    clipIds: ["clip_a", "clip_b"],
    withCaptions: false,
    ...data,
  },
});

Feature("stitchClipsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from("fake-mp4"));
    mockUnlink.mockResolvedValue(undefined);

    mockR2Send.mockImplementation((cmd) => {
      if (cmd.constructor.name === "GetObjectCommand") {
        return Promise.resolve({
          Body: (async function* () {
            yield Buffer.from("fake-chunk");
          })(),
        });
      }
      return Promise.resolve({});
    });

    execFileMock.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: (...a: unknown[]) => void) => {
        cb(null, "", "");
      }
    );
  });

  Scenario("all clips already exported", () => {
    it("Given 2 exported clips, Then stitches and returns stitchUrl", async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "clip_a",
                  start_sec: 0,
                  end_sec: 20,
                  export_url: "https://r2.example/a.mp4",
                  clip_title: "Clip A",
                },
                {
                  id: "clip_b",
                  start_sec: 20,
                  end_sec: 40,
                  export_url: "https://r2.example/b.mp4",
                  clip_title: "Clip B",
                },
              ],
              error: null,
            }),
          }),
        }),
      }));

      const { stitchClipsHandler } = await import("../stitch-clips");
      const result = await stitchClipsHandler(makeEvent(), makeStep());

      expect(result).toMatchObject({
        projectId: "proj_1",
        clipCount: 2,
      });
      expect(result.stitchUrl).toBeTruthy();
    });
  });

  Scenario("a clip has no export_url", () => {
    it("Given a clip without export_url, Then throws an error", async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "clip_a",
                  start_sec: 0,
                  end_sec: 20,
                  export_url: null,
                  clip_title: null,
                },
                {
                  id: "clip_b",
                  start_sec: 20,
                  end_sec: 40,
                  export_url: "https://r2.example/b.mp4",
                  clip_title: null,
                },
              ],
              error: null,
            }),
          }),
        }),
      }));

      const { stitchClipsHandler } = await import("../stitch-clips");
      await expect(stitchClipsHandler(makeEvent(), makeStep())).rejects.toThrow(
        /not yet exported/i
      );
    });
  });
});
