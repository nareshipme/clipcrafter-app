import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockProject = {
  id: "proj_1",
  title: "My Video",
  type: "upload",
  status: "pending",
  created_at: "2026-03-20T00:00:00.000Z",
};

Feature("POST /api/projects/create", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user creates a project", () => {
    it("Given valid body, Then returns 201 with project data", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
          }),
        }),
      });

      const { POST } = await import("@/app/api/projects/create/route");
      const req = new Request("http://localhost/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Video", type: "upload" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.id).toBe("proj_1");
      expect(json.title).toBe("My Video");
      expect(json.status).toBe("pending");
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { POST } = await import("@/app/api/projects/create/route");
      const req = new Request("http://localhost/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Video", type: "upload" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBeDefined();
    });
  });

  Scenario("missing required fields", () => {
    it("Given missing title, Then returns 400", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const { POST } = await import("@/app/api/projects/create/route");
      const req = new Request("http://localhost/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "upload" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("Given invalid type, Then returns 400", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const { POST } = await import("@/app/api/projects/create/route");
      const req = new Request("http://localhost/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Video", type: "invalid" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });
  });

  Scenario("Supabase insert fails", () => {
    it("Given a DB error, Then returns 500", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
          }),
        }),
      });

      const { POST } = await import("@/app/api/projects/create/route");
      const req = new Request("http://localhost/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Video", type: "upload" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBeDefined();
    });
  });
});
