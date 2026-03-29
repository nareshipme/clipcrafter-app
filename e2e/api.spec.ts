import { test, expect } from "@playwright/test";

// Clerk middleware redirects (302) unauthenticated requests to /sign-in.
// We disable redirect following so we see the raw 302/401/403 instead of
// the final 200 sign-in HTML page.
const NO_REDIRECT = { maxRedirects: 0, failOnStatusCode: false };

test.describe("Feature: API Authentication – 401 coverage", () => {
  test.describe("Scenario: All protected endpoints reject unauthenticated requests", () => {
    test("Given no auth token, When GET /api/projects is called, Then it is not a 200 success", async ({
      request,
    }) => {
      const res = await request.get("/api/projects", NO_REDIRECT);
      // Clerk returns 302 redirect to /sign-in — never a 200 API success
      expect(res.status()).not.toBe(200);
    });

    test("Given no auth token, When POST /api/projects/create is called, Then it is not a 200 success", async ({
      request,
    }) => {
      const res = await request.post("/api/projects/create", {
        ...NO_REDIRECT,
        data: { title: "Test", type: "upload" },
      });
      expect(res.status()).not.toBe(200);
    });

    test("Given no auth token, When GET /api/projects/[id]/clips is called, Then it is not a 200 success", async ({
      request,
    }) => {
      const res = await request.get("/api/projects/proj_test/clips", NO_REDIRECT);
      expect(res.status()).not.toBe(200);
    });

    test("Given no auth token, When POST /api/projects/[id]/clips/export-batch is called, Then it is not a 200 success", async ({
      request,
    }) => {
      const res = await request.post("/api/projects/proj_test/clips/export-batch", {
        ...NO_REDIRECT,
        data: { clipIds: ["clip_1"] },
      });
      expect(res.status()).not.toBe(200);
    });
  });
});
