import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
import { Feature, Scenario } from "@/test/bdd";

Feature("Inngest Client", () => {
  Scenario("inngest client is exported", () => {
    it("Given the inngest module, Then it exports an inngest client instance", async () => {
      const { inngest } = await import("@/lib/inngest");
      expect(inngest).toBeDefined();
      expect(typeof inngest.send).toBe("function");
      expect(typeof inngest.createFunction).toBe("function");
    });
  });
});

Feature("Process Video Inngest Function", () => {
  Scenario("processVideo function is defined", () => {
    it("Given the process-video module, Then it exports a processVideo function", async () => {
      const { processVideo } = await import("@/inngest/functions/process-video");
      expect(processVideo).toBeDefined();
    });
  });
});
