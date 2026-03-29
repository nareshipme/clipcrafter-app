import { test as base, expect } from "@playwright/test";
import { test as authTest } from "./fixtures";

base.describe("Feature: Authentication – unauthenticated", () => {
  base.describe("Scenario: Unauthenticated redirect", () => {
    base("Given unauthenticated user, When they visit /dashboard, Then they are redirected to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  base.describe("Scenario: Sign-in page renders without errors", () => {
    base("Given any visitor, When they visit /sign-in, Then the page loads without errors", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/500|error/);
    });
  });
});

authTest.describe("Feature: Authentication – authenticated", () => {
  authTest.describe("Scenario: Authenticated user can access /dashboard", () => {
    authTest("Given authenticated user, When they visit /dashboard, Then they are not redirected to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).not.toHaveURL(/sign-in/);
    });
  });
});
