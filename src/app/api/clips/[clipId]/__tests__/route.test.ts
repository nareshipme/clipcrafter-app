import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

const mockGetSupabaseUserId = vi.fn();
vi.mock("@/lib/user", () => ({ getSupabaseUserId: mockGetSupabaseUserId }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockParams = Promise.resolve({ clipId: "clip_1" });

const mockClip = {
  id: "clip_1",
  project_id: "proj_1",
  status: "pending",
  caption_style: "hormozi",
  aspect_ratio: "9:16",
  projects: { user_id: "user_123" },
};

Feature("PATCH /api/clips/[clipId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user approves a clip", () => {
    it("Given valid clipId and status=approved, Then updates and returns clip", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      const updatedClip = { ...mockClip, status: "approved" };

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockClip, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedClip, error: null }),
            }),
          }),
        }),
      }));

      const { PATCH } = await import("@/app/api/clips/[clipId]/route");
      const req = new Request("http://localhost/api/clips/clip_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const res = await PATCH(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clip.status).toBe("approved");
    });
  });

  Scenario("updating caption_style", () => {
    it("Given caption_style=neon, Then updates clip with new style", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      const updatedClip = { ...mockClip, caption_style: "neon" };

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockClip, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedClip, error: null }),
            }),
          }),
        }),
      }));

      const { PATCH } = await import("@/app/api/clips/[clipId]/route");
      const req = new Request("http://localhost/api/clips/clip_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption_style: "neon" }),
      });
      const res = await PATCH(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clip.caption_style).toBe("neon");
    });
  });

  Scenario("invalid status value", () => {
    it("Given status=invalid, Then returns 400", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      const { PATCH } = await import("@/app/api/clips/[clipId]/route");
      const req = new Request("http://localhost/api/clips/clip_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid_status" }),
      });
      const res = await PATCH(req, { params: mockParams });
      expect(res.status).toBe(400);
    });
  });

  Scenario("unauthenticated PATCH", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { PATCH } = await import("@/app/api/clips/[clipId]/route");
      const req = new Request("http://localhost/api/clips/clip_1", {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      const res = await PATCH(req, { params: mockParams });
      expect(res.status).toBe(401);
    });
  });

  Scenario("clip belongs to different user", () => {
    it("Given mismatched user, Then returns 403", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_other" });
      mockGetSupabaseUserId.mockResolvedValue("user_other");

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockClip, projects: { user_id: "user_123" } },
              error: null,
            }),
          }),
        }),
      }));

      const { PATCH } = await import("@/app/api/clips/[clipId]/route");
      const req = new Request("http://localhost/api/clips/clip_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const res = await PATCH(req, { params: mockParams });
      expect(res.status).toBe(403);
    });
  });
});
