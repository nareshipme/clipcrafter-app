import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const mockProjects = [
  { id: "proj_1", title: "Video 1", status: "completed", created_at: "2026-03-20T00:00:00.000Z" },
  { id: "proj_2", title: "Video 2", status: "pending", created_at: "2026-03-19T00:00:00.000Z" },
];

Feature("GET /api/projects", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user lists their projects", () => {
    it("Given a user with projects, Then returns paginated projects and total", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const mockRange = vi.fn().mockResolvedValue({
        data: mockProjects,
        count: 2,
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { GET } = await import("@/app/api/projects/route");
      const req = new Request("http://localhost/api/projects");

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.projects)).toBe(true);
      expect(json.projects).toHaveLength(2);
      expect(json.total).toBe(2);
    });

    it("Given no projects, Then returns empty array with total 0", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const mockRange = vi.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const { GET } = await import("@/app/api/projects/route");
      const req = new Request("http://localhost/api/projects");

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.projects).toHaveLength(0);
      expect(json.total).toBe(0);
    });
  });

  Scenario("unauthenticated request", () => {
    it("Given no userId, Then returns 401", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const { GET } = await import("@/app/api/projects/route");
      const req = new Request("http://localhost/api/projects");

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBeDefined();
    });
  });
});
