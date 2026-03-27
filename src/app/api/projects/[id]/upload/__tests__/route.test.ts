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

const mockGetPresignedUploadUrl = vi.fn();
vi.mock("@/lib/r2", () => ({
  getPresignedUploadUrl: mockGetPresignedUploadUrl,
}));

const mockProject = {
  id: "proj_1",
  user_id: "user_123",
  status: "pending",
};

const mockParams = Promise.resolve({ id: "proj_1" });

Feature("POST /api/projects/[id]/upload", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user gets a presigned upload URL", () => {
    it("Given a valid project, Then returns uploadUrl and key", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
          }),
        }),
      });
      mockGetPresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://r2.example.com/upload?sig=abc",
        key: "uploads/user_123/video.mp4",
        publicUrl: "https://r2.example.com/uploads/user_123/video.mp4",
      });

      const { POST } = await import("@/app/api/projects/[id]/upload/route");
      const req = new Request("http://localhost/api/projects/proj_1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "video.mp4", contentType: "video/mp4" }),
      });

      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.uploadUrl).toBeDefined();
      expect(json.key).toBeDefined();
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { POST } = await import("@/app/api/projects/[id]/upload/route");
      const req = new Request("http://localhost/api/projects/proj_1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "video.mp4", contentType: "video/mp4" }),
      });

      const res = await POST(req, { params: mockParams });
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

      const { POST } = await import("@/app/api/projects/[id]/upload/route");
      const req = new Request("http://localhost/api/projects/proj_1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "video.mp4", contentType: "video/mp4" }),
      });

      const res = await POST(req, { params: mockParams });
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

      const { POST } = await import("@/app/api/projects/[id]/upload/route");
      const req = new Request("http://localhost/api/projects/proj_1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "video.mp4", contentType: "video/mp4" }),
      });

      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBeDefined();
    });
  });
});
