import { test, expect } from "@playwright/test";

test.describe("Zebra Layout Responsiveness", () => {
  const viewports = [
    { name: "mobile", width: 375, height: 667 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`should render correctly on ${vp.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // Verify page title and header logo visible
      await expect(page.getByText("ZEBRA", { exact: true })).toBeVisible();

      // Ensure no horizontal scrollbars exist by validating viewport bounds
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5); // Allow small buffer
    });
  }
});
