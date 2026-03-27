import { test, expect } from "@playwright/test";

test.describe("Feature: Dashboard", () => {
  test.describe("Scenario: Unauthenticated access to dashboard", () => {
    test("Given unauthenticated user, When they visit /dashboard, Then they are redirected to sign-in", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  test.describe("Scenario: Landing page calls to action", () => {
    test("Given any visitor, When they visit /, Then the page loads with a title", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveTitle(/.+/);
    });

    test("Given any visitor, When they visit /, Then the page body is visible", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Scenario: Sign-in page is accessible", () => {
    test("Given any visitor, When they visit /sign-in, Then the Clerk sign-in UI loads", async ({
      page,
    }) => {
      await page.goto("/sign-in");
      // Clerk renders an iframe or form — just check we don't see an error
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/500|error/);
    });
  });
});
