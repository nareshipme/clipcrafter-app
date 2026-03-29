import { test, expect } from "@playwright/test";

// Clerk middleware returns a redirect (302 → sign-in HTML) for browser requests,
// but returns 401 JSON for requests with Accept: application/json.
// We send the JSON header to get a proper 401 back from the API.
const jsonHeaders = { Accept: "application/json" };

test.describe("Feature: API Authentication – 401 coverage", () => {
  test.describe("Scenario: All protected endpoints reject unauthenticated requests", () => {
    test("Given no auth token, When GET /api/projects is called, Then it returns 401", async ({
      request,
    }) => {
      const res = await request.get("/api/projects", {
        headers: jsonHeaders,
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When POST /api/projects/create is called, Then it returns 401", async ({
      request,
    }) => {
      const res = await request.post("/api/projects/create", {
        headers: jsonHeaders,
        data: { title: "Test", type: "upload" },
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When GET /api/projects/[id]/clips is called, Then it returns 401", async ({
      request,
    }) => {
      const res = await request.get("/api/projects/proj_test/clips", {
        headers: jsonHeaders,
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When POST /api/projects/[id]/clips/export-batch is called, Then it returns 401", async ({
      request,
    }) => {
      const res = await request.post("/api/projects/proj_test/clips/export-batch", {
        headers: jsonHeaders,
        data: { clipIds: ["clip_1"] },
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(res.status());
    });
  });
});
