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

const mockSend = vi.fn();
vi.mock("@/lib/inngest", () => ({
  inngest: { send: mockSend },
}));

const mockParams = Promise.resolve({ clipId: "clip_1" });

const mockClip = {
  id: "clip_1",
  project_id: "proj_1",
  status: "approved",
  projects: { user_id: "user_123" },
};

Feature("POST /api/clips/[clipId]/export", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user triggers clip export", () => {
    it("Given approved clip, Then sets status=exporting and sends Inngest event", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");
      mockSend.mockResolvedValue(undefined);

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockClip, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }));

      const { POST } = await import("@/app/api/clips/[clipId]/export/route");
      const req = new Request("http://localhost/api/clips/clip_1/export", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(202);
      expect(json.status).toBe("exporting");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ name: "clipcrafter/clip.export" })
      );
    });
  });

  Scenario("unauthenticated export request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { POST } = await import("@/app/api/clips/[clipId]/export/route");
      const req = new Request("http://localhost/api/clips/clip_1/export", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(401);
    });
  });

  Scenario("clip not found", () => {
    it("Given missing clip, Then returns 404", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      }));

      const { POST } = await import("@/app/api/clips/[clipId]/export/route");
      const req = new Request("http://localhost/api/clips/clip_1/export", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(404);
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

      const { POST } = await import("@/app/api/clips/[clipId]/export/route");
      const req = new Request("http://localhost/api/clips/clip_1/export", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      expect(res.status).toBe(403);
    });
  });
});
