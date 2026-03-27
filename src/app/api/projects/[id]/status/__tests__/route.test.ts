import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

// Return the clerkId as-is so user_id mismatches in 403 tests still work
const mockGetSupabaseUserId = vi.fn().mockImplementation((id: string) => Promise.resolve(id));
vi.mock("@/lib/user", () => ({ getSupabaseUserId: mockGetSupabaseUserId }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockProject = {
  id: "proj_1",
  user_id: "user_123",
  status: "completed",
  transcript: "Hello world",
  highlights: ["clip1", "clip2"],
};

const mockParams = Promise.resolve({ id: "proj_1" });

Feature("GET /api/projects/[id]/status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user fetches project status", () => {
    it("Given a valid project, Then returns id, status, transcript, highlights", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const mockTranscriptRow = {
        id: "tx_1",
        segments: [{ id: 0, start: 0, end: 5, text: "Hello world" }],
      };
      const mockHighlightRow = { id: "hl_1", segments: [{ start: 0, end: 5, text: "clip1" }] };

      // For the completed project, the route calls:
      //   1. from("projects").select(...).eq(id).single()    — project lookup
      //   2. from("transcripts").select(...).eq(...).order(...).limit(1).single()
      //   3. from("highlights").select(...).eq(...).order(...).limit(1).single()
      const makeOrderChain = (data: unknown) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data, error: null }),
              }),
            }),
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "transcripts") return makeOrderChain(mockTranscriptRow);
        if (table === "highlights") return makeOrderChain(mockHighlightRow);
        // "projects"
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
            }),
          }),
        };
      });

      const { GET } = await import("@/app/api/projects/[id]/status/route");
      const req = new Request("http://localhost/api/projects/proj_1/status");

      const res = await GET(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.id).toBe("proj_1");
      expect(json.status).toBe("completed");
      expect(json.transcript).toMatchObject({ id: "tx_1" });
      expect(json.highlights).toMatchObject({ id: "hl_1" });
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { GET } = await import("@/app/api/projects/[id]/status/route");
      const req = new Request("http://localhost/api/projects/proj_1/status");

      const res = await GET(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBeDefined();
    });
  });

  Scenario("project not found", () => {
    it("Given missing project, Then returns 404", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/projects/[id]/status/route");
      const req = new Request("http://localhost/api/projects/proj_1/status");

      const res = await GET(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBeDefined();
    });
  });

  Scenario("project belongs to different user", () => {
    it("Given mismatched user_id, Then returns 403", async () => {
      mockAuth.mockResolvedValue({ userId: "user_other" });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockProject, user_id: "user_123" },
              error: null,
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/projects/[id]/status/route");
      const req = new Request("http://localhost/api/projects/proj_1/status");

      const res = await GET(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBeDefined();
    });
  });
});
