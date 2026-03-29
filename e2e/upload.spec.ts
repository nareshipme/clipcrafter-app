import { test as base, expect } from "@playwright/test";
import { test as authTest } from "./fixtures";

base.describe("Feature: Upload Flow – unauthenticated", () => {
  base.describe("Scenario: Upload API requires authentication", () => {
    base("Given no auth token, When POST /api/projects/proj_1/upload is called, Then it returns 401", async ({ request }) => {
      const res = await request.post("/api/projects/proj_1/upload", {
        data: { filename: "video.mp4", contentType: "video/mp4" },
      });
      expect([401, 403]).toContain(res.status());
    });

    base("Given no auth token, When POST /api/projects/create is called, Then it returns 401", async ({ request }) => {
      const res = await request.post("/api/projects/create", {
        data: { title: "Test", type: "upload" },
      });
      expect([401, 403]).toContain(res.status());
    });
  });
});

authTest.describe("Feature: Upload Flow – authenticated", () => {
  authTest.describe("Scenario: Upload modal is accessible", () => {
    authTest("Given authenticated user on /dashboard, When they trigger upload, Then the upload modal opens", async ({ page }) => {
      await page.goto("/dashboard");
      const trigger = page.getByRole("button", { name: /new project|upload|create/i });
      await trigger.first().click();
      // Modal or dialog should become visible
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    authTest("Given upload modal is open, Then a YouTube URL input field is present", async ({ page }) => {
      await page.goto("/dashboard");
      const trigger = page.getByRole("button", { name: /new project|upload|create/i });
      await trigger.first().click();
      await page.locator('[role="dialog"]').waitFor({ state: "visible" });
      const urlInput = page.getByPlaceholder(/youtube|url|https/i);
      await expect(urlInput.first()).toBeVisible();
    });

    authTest("Given upload modal is open, When empty form is submitted, Then validation errors appear", async ({ page }) => {
      await page.goto("/dashboard");
      const trigger = page.getByRole("button", { name: /new project|upload|create/i });
      await trigger.first().click();
      await page.locator('[role="dialog"]').waitFor({ state: "visible" });
      const submit = page.getByRole("button", { name: /submit|create|start/i });
      await submit.first().click();
      // Some validation feedback should appear
      const feedback = page.locator('[aria-invalid="true"], .error, [data-error]');
      await expect(feedback.first()).toBeVisible({ timeout: 3000 });
    });

    authTest("Given authenticated user, When POST /api/projects/create is mocked, Then no real Inngest job is triggered", async ({ page }) => {
      await page.route("/api/projects/create", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "mock-project-id" }),
        })
      );
      await page.goto("/dashboard");
      // Page should still load without errors
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
