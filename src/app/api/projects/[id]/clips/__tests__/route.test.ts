import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

// Return clerkId as-is so user_id mismatches work for 403 tests
const mockGetSupabaseUserId = vi.fn().mockImplementation((id: string) => Promise.resolve(id));
vi.mock("@/lib/user", () => ({ getSupabaseUserId: mockGetSupabaseUserId }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockInngestSend = vi.fn().mockResolvedValue({});
vi.mock("@/lib/inngest", () => ({
  inngest: { send: mockInngestSend },
}));

const mockParams = Promise.resolve({ id: "proj_1" });

Feature("POST /api/projects/[id]/clips", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user triggers clip generation via Inngest", () => {
    it("Given valid project + existing transcript, Then fires Inngest job and returns 202", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");
      mockInngestSend.mockResolvedValue({});

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "proj_1", user_id: "user_123" },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "transcripts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "tx_1" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(202);
      expect(json.status).toBe("generating");
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({ name: "clips/generate" })
      );
    });
  });

  Scenario("no transcript yet returns 422", () => {
    it("Given project with no transcript, Then returns 422", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "proj_1", user_id: "user_123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "transcripts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips", { method: "POST" });
      const res = await POST(req, { params: mockParams });

      expect(res.status).toBe(422);
    });
  });

  Scenario("unauthenticated POST", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { POST } = await import("@/app/api/projects/[id]/clips/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(401);
    });
  });

  Scenario("project belongs to different user", () => {
    it("Given mismatched user_id, Then returns 403", async () => {
      mockAuth.mockResolvedValue({ userId: "user_other" });
      mockGetSupabaseUserId.mockResolvedValue("user_other");

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "proj_1", user_id: "user_123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(403);
    });
  });
});

Feature("GET /api/projects/[id]/clips", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user lists clips", () => {
    it("Given existing clips, Then returns clips array and clips_status", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      const mockClips = [
        { id: "clip_a", score: 85, status: "pending" },
        { id: "clip_b", score: 72, status: "approved" },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "proj_1",
                    user_id: "user_123",
                    clips_status: "idle",
                    topic_map: null,
                    video_graph: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "clips") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockClips, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { GET } = await import("@/app/api/projects/[id]/clips/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips");
      const res = await GET(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clips).toHaveLength(2);
      expect(json.clips_status).toBe("idle");
    });
  });
});
