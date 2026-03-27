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

const mockR2Send = vi.fn().mockResolvedValue({ Contents: [] });
vi.mock("@/lib/r2", () => ({
  r2Client: { send: mockR2Send },
  R2_BUCKET: "test-bucket",
}));

vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}));

const mockProject = {
  id: "proj_1",
  user_id: "user_123",
  r2_key: "uploads/user_123/video.mp4",
  audio_key: "audio/user_123/audio.mp3",
};

const mockParams = Promise.resolve({ id: "proj_1" });

Feature("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockR2Send.mockResolvedValue({ Contents: [] });
  });

  Scenario("authenticated user deletes their project", () => {
    it("Given a valid project, Then deletes R2 files and DB row, returns 200", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const { DELETE } = await import("@/app/api/projects/[id]/route");
      const req = new Request("http://localhost/api/projects/proj_1", { method: "DELETE" });

      const res = await DELETE(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { DELETE } = await import("@/app/api/projects/[id]/route");
      const req = new Request("http://localhost/api/projects/proj_1", { method: "DELETE" });

      const res = await DELETE(req, { params: mockParams });
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
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      });

      const { DELETE } = await import("@/app/api/projects/[id]/route");
      const req = new Request("http://localhost/api/projects/proj_1", { method: "DELETE" });

      const res = await DELETE(req, { params: mockParams });
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

      const { DELETE } = await import("@/app/api/projects/[id]/route");
      const req = new Request("http://localhost/api/projects/proj_1", { method: "DELETE" });

      const res = await DELETE(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBeDefined();
    });
  });

  Scenario("R2 cleanup with existing exports", () => {
    it("Given exports in R2, Then lists and deletes them before removing DB row", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockR2Send
        .mockResolvedValueOnce({}) // DeleteObjectCommand for r2_key
        .mockResolvedValueOnce({}) // DeleteObjectCommand for audio_key
        .mockResolvedValueOnce({ Contents: [{ Key: "exports/proj_1/clip1.mp4" }] }) // ListObjectsV2 exports/
        .mockResolvedValueOnce({}) // DeleteObjectsCommand
        .mockResolvedValueOnce({ Contents: [] }); // ListObjectsV2 temp-sources/

      mockFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const { DELETE } = await import("@/app/api/projects/[id]/route");
      const req = new Request("http://localhost/api/projects/proj_1", { method: "DELETE" });

      const res = await DELETE(req, { params: mockParams });
      expect(res.status).toBe(200);
    });
  });
});
