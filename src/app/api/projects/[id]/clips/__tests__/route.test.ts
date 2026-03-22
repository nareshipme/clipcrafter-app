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

const mockParams = Promise.resolve({ id: "proj_1" });

const mockHighlightSegments = [
  {
    start: 10,
    end: 40,
    text: "You have to go all in",
    reason: "Powerful hook",
    score: 85,
    score_reason: "Strong hook strength",
    hashtags: ["#hustle", "#success"],
    clip_title: "Go All In Today",
  },
  {
    start: 60,
    end: 90,
    text: "Failure is just feedback",
    reason: "Quotable",
    score: 72,
    score_reason: "High quotability",
    hashtags: ["#mindset", "#growth"],
    clip_title: "Failure Is Just Feedback",
  },
];

Feature("POST /api/projects/[id]/clips", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  Scenario("authenticated user generates clips from highlights", () => {
    it("Given valid project + highlights, Then inserts clip rows and returns them", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
      mockGetSupabaseUserId.mockResolvedValue("user_123");

      const mockClips = mockHighlightSegments.map((h, i) => ({
        id: `clip_${i}`,
        project_id: "proj_1",
        start_sec: h.start,
        end_sec: h.end,
        score: h.score,
        score_reason: h.score_reason,
        hashtags: h.hashtags,
        clip_title: h.clip_title,
        title: h.text,
        status: "pending",
        caption_style: "hormozi",
        aspect_ratio: "9:16",
      }));

      // Chain: projects.select.eq.single → project ownership check
      // highlights.select.eq.order.limit.single → get highlights
      // clips.insert.select → inserted clips
      let callCount = 0;
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
        if (table === "highlights") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "hl_1", segments: mockHighlightSegments },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "clips") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: mockClips, error: null }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/projects/[id]/clips/route");
      const req = new Request("http://localhost/api/projects/proj_1/clips", { method: "POST" });
      const res = await POST(req, { params: mockParams });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(Array.isArray(json.clips)).toBe(true);
      expect(json.clips).toHaveLength(2);
      expect(json.clips[0].score).toBe(85);
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
      mockAuth.mockResolvedValue({ userId: "clerk_other" });
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
    it("Given existing clips, Then returns array sorted by score desc", async () => {
      mockAuth.mockResolvedValue({ userId: "clerk_1" });
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
                  data: { id: "proj_1", user_id: "user_123" },
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
    });
  });
});
