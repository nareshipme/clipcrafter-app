import { test, expect } from "@playwright/test";

test.describe("Feature: Upload Flow", () => {
  test.describe("Scenario: Unauthenticated access to upload-related routes", () => {
    test("Given unauthenticated user, When they visit /dashboard, Then they cannot access the upload UI", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      // Clerk redirects to sign-in — upload modal is never shown
      await expect(page).toHaveURL(/sign-in/);
    });

    test("Given unauthenticated user, When they visit a project detail page, Then they are redirected to sign-in", async ({
      page,
    }) => {
      await page.goto("/dashboard/projects/some-project-id");
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  test.describe("Scenario: API upload endpoint requires authentication", () => {
    test("Given no auth token, When POST /api/projects/proj_1/upload is called, Then it returns 401", async ({
      request,
    }) => {
      const res = await request.post("/api/projects/proj_1/upload", {
        data: { filename: "video.mp4", contentType: "video/mp4" },
      });
      // Clerk middleware rejects unauthenticated API calls with 401
      expect([401, 403]).toContain(res.status());
    });

    test("Given no auth token, When POST /api/projects/create is called, Then it returns 401", async ({
      request,
    }) => {
      const res = await request.post("/api/projects/create", {
        data: { title: "Test", type: "upload" },
      });
      expect([401, 403]).toContain(res.status());
    });
  });
});
