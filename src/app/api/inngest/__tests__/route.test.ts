import { describe, it, expect, vi } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

vi.mock("inngest/next", () => ({
  serve: vi.fn().mockReturnValue({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
  }),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { id: "toolnexus" },
}));

vi.mock("@/inngest/functions/process-video", () => ({
  processVideo: { id: "process-video" },
}));

vi.mock("@/inngest/functions/clip-export", () => ({
  clipExport: { id: "clip-export" },
}));

vi.mock("@/inngest/functions/generate-clips", () => ({
  generateClips: { id: "generate-clips" },
}));

vi.mock("@/inngest/functions/stitch-clips", () => ({
  stitchClips: { id: "stitch-clips" },
}));

Feature("Inngest Serve Route", () => {
  Scenario("route exports GET, POST, PUT handlers", () => {
    it("Given the inngest route module, Then it exports GET POST and PUT", async () => {
      const route = await import("@/app/api/inngest/route");
      expect(route.GET).toBeDefined();
      expect(route.POST).toBeDefined();
      expect(route.PUT).toBeDefined();
    });
  });
});
