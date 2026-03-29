import { test as base, expect } from "@playwright/test";
import { test as authTest } from "./fixtures";

const skipIfNoTestUser =
  !process.env.E2E_TEST_USER_EMAIL || process.env.E2E_TEST_USER_EMAIL === "test@example.com";

base.describe("Feature: Dashboard – unauthenticated", () => {
  base.describe("Scenario: Unauthenticated access is blocked", () => {
    base(
      "Given unauthenticated user, When they visit /dashboard, Then they are redirected to sign-in",
      async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page).toHaveURL(/sign-in/);
      }
    );
  });
});

authTest.describe("Feature: Dashboard – authenticated", () => {
  authTest.describe("Scenario: Authenticated user lands on /dashboard", () => {
    authTest(
      "Given authenticated user, When they visit /dashboard, Then they are not redirected",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.goto("/dashboard");
        await expect(page).not.toHaveURL(/sign-in/);
      }
    );

    authTest(
      "Given authenticated user on /dashboard, Then there are no console errors",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        const errors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });
        await page.goto("/dashboard");
        await expect(page.locator("body")).toBeVisible();
        expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
      }
    );

    authTest(
      "Given authenticated user on /dashboard, Then a 'New Project' or upload trigger is visible",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        await page.goto("/dashboard");
        const trigger = page.getByRole("button", {
          name: /new project|upload|create/i,
        });
        await expect(trigger.first()).toBeVisible();
      }
    );

    authTest(
      "Given authenticated user on /dashboard, Then there are no 500 errors",
      async ({ page }) => {
        authTest.skip(skipIfNoTestUser, "No real E2E test user configured");
        const responses: number[] = [];
        page.on("response", (res) => responses.push(res.status()));
        await page.goto("/dashboard");
        expect(responses.some((s) => s === 500)).toBe(false);
      }
    );
  });
});
