import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

const mockGetSupabaseUserId = vi.fn().mockImplementation((id: string) => Promise.resolve(id));
vi.mock("@/lib/user", () => ({ getSupabaseUserId: mockGetSupabaseUserId }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockInngestSend = vi.fn().mockResolvedValue({ ids: ["event_123"] });
vi.mock("@/lib/inngest", () => ({
  inngest: { send: mockInngestSend },
}));

const mockParams = Promise.resolve({ id: "proj_1" });

function makeProjectMock(userId = "user_123") {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "proj_1", user_id: userId },
          error: null,
        }),
      }),
    }),
  };
}

function makeClipsMock(ids = ["clip_a", "clip_b"]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: ids.map((id) => ({ id })),
          error: null,
        }),
      }),
    }),
  };
}

Feature("POST /api/projects/[id]/clips/stitch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user stitches 2+ valid clips", () => {
    it("Given valid clipIds, Then fires Inngest event and returns 202 with jobId", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");
      mockInngestSend.mockResolvedValue({ ids: ["event_abc"] });

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") return makeProjectMock("user_123");
        if (table === "clips") return makeClipsMock(["clip_a", "clip_b"]);
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/stitch/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: ["clip_a", "clip_b"], withCaptions: false }),
      });
      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(202);
      expect(json.jobId).toBe("event_abc");
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({ name: "clipcrafter/clips.stitch" })
      );
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { POST } = await import("@/app/api/projects/[id]/clips/stitch/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: ["a", "b"] }),
      });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(401);
    });
  });

  Scenario("fewer than 2 clipIds provided", () => {
    it("Given clipIds array with 1 item, Then returns 400", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      const { POST } = await import("@/app/api/projects/[id]/clips/stitch/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: ["only_one"] }),
      });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(400);
    });
  });

  Scenario("project belongs to a different user", () => {
    it("Given mismatched user_id, Then returns 403", async () => {
      mockAuth.mockResolvedValue({ userId: "user_other" });
      mockGetSupabaseUserId.mockResolvedValue("user_other");

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") return makeProjectMock("user_123");
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/stitch/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: ["a", "b"] }),
      });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(403);
    });
  });

  Scenario("project not found", () => {
    it("Given non-existent project, Then returns 404", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/stitch/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: ["a", "b"] }),
      });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(404);
    });
  });
});
