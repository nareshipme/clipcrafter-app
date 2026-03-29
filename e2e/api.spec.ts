import { test, expect } from "@playwright/test";

test.describe("Feature: API Authentication – 401 coverage", () => {
  test.describe("Scenario: All protected endpoints reject unauthenticated requests", () => {
    test("Given no auth token, When GET /api/projects is called, Then it returns 401", async ({ request }) => {
      const res = await request.get("/api/projects");
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When POST /api/projects/create is called, Then it returns 401", async ({ request }) => {
      const res = await request.post("/api/projects/create", {
        data: { title: "Test", type: "upload" },
      });
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When GET /api/projects/[id]/clips is called, Then it returns 401", async ({ request }) => {
      const res = await request.get("/api/projects/proj_test/clips");
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When POST /api/projects/[id]/clips/export-batch is called, Then it returns 401", async ({ request }) => {
      const res = await request.post("/api/projects/proj_test/clips/export-batch", {
        data: { clipIds: ["clip_1"] },
      });
      expect([401, 403]).toContain(res.status());
    });
  });
});
