import { test as base } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

export const test = base.extend({
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page });
    await use(page);
  },
});
export { expect } from "@playwright/test";
