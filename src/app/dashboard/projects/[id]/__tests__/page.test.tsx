/**
 * Tests for the project detail page zone pages.
 *
 * The previous monolithic ProjectDetailContent has been split into:
 *   - layout.tsx  — shared top bar, nav, mini-player
 *   - studio/page.tsx — PlayerSection + CompletedSidebar + ProcessingStatus
 *   - insights/page.tsx — transcript + how it ran
 *   - outputs/page.tsx — downloads
 *   - settings/page.tsx — project settings + delete
 *
 * Component-level tests for each zone live alongside their respective page files.
 * This file is kept as a placeholder to avoid orphaned test infrastructure.
 */

describe("project page zones", () => {
  it("placeholder — zone page tests pending", () => {
    expect(true).toBe(true);
  });
});
