import { test as base, expect } from "@playwright/test";
import { test as authTest } from "./fixtures";

const skipIfNoTestUser =
  !process.env.E2E_TEST_USER_EMAIL || process.env.E2E_TEST_USER_EMAIL === "test@example.com";

base.describe("Feature: Project Page – unauthenticated", () => {
  base.describe("Scenario: Unauthenticated access is blocked", () => {
    base(
      "Given unauthenticated user, When they visit /dashboard/projects/[id], Then they are redirected to sign-in",
      async ({ page }) => {
        await page.goto("/dashboard/projects/some-project-id");
        await expect(page).toHaveURL(/sign-in/);
      }
    );
  });
});

authTest.describe("Feature: Project Page – authenticated", () => {
  authTest.describe("Scenario: Project page renders with mocked data", () => {
    authTest(
      "Given mocked project data, When authenticated user visits /dashboard/projects/[id], Then the page renders correctly",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.route("/api/projects/mock-project-id", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "mock-project-id",
              title: "Mock Project",
              status: "ready",
            }),
          })
        );
        await page.goto("/dashboard/projects/mock-project-id");
        await expect(page).not.toHaveURL(/sign-in/);
        await expect(page.locator("body")).toBeVisible();
      }
    );

    authTest(
      "Given authenticated user on a project page, Then there are no 500 errors",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        const statuses: number[] = [];
        page.on("response", (res) => statuses.push(res.status()));
        await page.goto("/dashboard/projects/mock-project-id");
        expect(statuses.some((s) => s === 500)).toBe(false);
      }
    );
  });
});
