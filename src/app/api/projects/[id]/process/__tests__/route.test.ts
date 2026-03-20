import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockSend = vi.fn();
vi.mock("@/lib/inngest", () => ({
  inngest: { send: mockSend },
}));

const mockProject = {
  id: "proj_1",
  user_id: "user_123",
  r2_key: "uploads/user_123/video.mp4",
  status: "pending",
};

const mockParams = Promise.resolve({ id: "proj_1" });

Feature("POST /api/projects/[id]/process", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user triggers processing", () => {
    it("Given a valid project, Then updates status and sends Inngest event", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockSelectEq = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      });
      mockFrom
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({ eq: mockSelectEq }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
        });

      mockSend.mockResolvedValue({});

      const { POST } = await import("@/app/api/projects/[id]/process/route");
      const req = new Request(
        "http://localhost/api/projects/proj_1/process",
        { method: "POST" }
      );

      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("processing");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ name: "video/process" })
      );
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { POST } = await import("@/app/api/projects/[id]/process/route");
      const req = new Request(
        "http://localhost/api/projects/proj_1/process",
        { method: "POST" }
      );

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
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      });

      const { POST } = await import("@/app/api/projects/[id]/process/route");
      const req = new Request(
        "http://localhost/api/projects/proj_1/process",
        { method: "POST" }
      );

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

      const { POST } = await import("@/app/api/projects/[id]/process/route");
      const req = new Request(
        "http://localhost/api/projects/proj_1/process",
        { method: "POST" }
      );

      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBeDefined();
    });
  });
});
