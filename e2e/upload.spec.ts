import { test as base, expect } from "@playwright/test";
import { test as authTest } from "./fixtures";

const NO_REDIRECT = { maxRedirects: 0, failOnStatusCode: false };

base.describe("Feature: Upload Flow – unauthenticated", () => {
  base.describe("Scenario: Upload API requires authentication", () => {
    base(
      "Given no auth token, When POST /api/projects/proj_1/upload is called, Then it is not a 200 success",
      async ({ request }) => {
        const res = await request.post("/api/projects/proj_1/upload", {
          ...NO_REDIRECT,
          data: { filename: "video.mp4", contentType: "video/mp4" },
        });
        expect(res.status()).not.toBe(200);
      }
    );

    base(
      "Given no auth token, When POST /api/projects/create is called, Then it is not a 200 success",
      async ({ request }) => {
        const res = await request.post("/api/projects/create", {
          ...NO_REDIRECT,
          data: { title: "Test", type: "upload" },
        });
        expect(res.status()).not.toBe(200);
      }
    );
  });
});

// Authenticated upload tests require a real Clerk test user.
// Set E2E_TEST_USER_EMAIL + E2E_TEST_USER_PASSWORD in GitHub secrets to enable.
const skipIfNoTestUser =
  !process.env.E2E_TEST_USER_EMAIL || process.env.E2E_TEST_USER_EMAIL === "test@example.com";

authTest.describe("Feature: Upload Flow – authenticated", () => {
  authTest.describe("Scenario: Upload modal is accessible", () => {
    authTest(
      "Given authenticated user on /dashboard, When they trigger upload, Then the upload modal opens",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.goto("/dashboard");
        const trigger = page.getByRole("button", {
          name: /new project|upload|create/i,
        });
        await trigger.first().click();
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    );

    authTest(
      "Given upload modal is open, Then a YouTube URL input field is present",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.goto("/dashboard");
        const trigger = page.getByRole("button", {
          name: /new project|upload|create/i,
        });
        await trigger.first().click();
        await page.locator('[role="dialog"]').waitFor({ state: "visible" });
        const urlInput = page.getByPlaceholder(/youtube|url|https/i);
        await expect(urlInput.first()).toBeVisible();
      }
    );

    authTest(
      "Given upload modal is open, When empty form is submitted, Then validation errors appear",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.goto("/dashboard");
        const trigger = page.getByRole("button", {
          name: /new project|upload|create/i,
        });
        await trigger.first().click();
        await page.locator('[role="dialog"]').waitFor({ state: "visible" });
        const submit = page.getByRole("button", {
          name: /submit|create|start/i,
        });
        await submit.first().click();
        const feedback = page.locator('[aria-invalid="true"], .error, [data-error]');
        await expect(feedback.first()).toBeVisible({ timeout: 3000 });
      }
    );

    authTest(
      "Given authenticated user, When POST /api/projects/create is mocked, Then page renders without errors",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.route("/api/projects/create", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ id: "mock-project-id" }),
          })
        );
        await page.goto("/dashboard");
        await expect(page.locator("body")).toBeVisible();
      }
    );
  });
});
