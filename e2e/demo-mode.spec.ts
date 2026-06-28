import { test, expect } from "@playwright/test";

test.describe("Zebra Smoke Tests (Demo Mode)", () => {
  test("should load the landing page successfully", async ({ page }) => {
    await page.goto("/");

    // Check title and primary header
    await expect(page).toHaveTitle(/Zebra — Confidential Stablecoin Payroll/i);
    await expect(page.getByText("ZEBRA", { exact: true })).toBeVisible();

    // Check key elements are present on landing page
    await expect(
      page.getByText("CONFIDENTIALSTABLECOIN PAYROLL"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /LAUNCH CFO DASHBOARD/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /ENTER AUDITOR PORTAL/i }),
    ).toBeVisible();
  });

  test("should navigate between views using header tabs", async ({ page }) => {
    await page.goto("/");

    // Click on CFO Portal tab
    await page.getByRole("button", { name: "[ CFO PORTAL ]" }).click();
    await expect(page.getByText("CFO PAYROLL DISBURSEMENT")).toBeVisible();

    // Click on Auditor Console tab
    await page.getByRole("button", { name: "[ AUDITOR CONSOLE ]" }).click();
    await expect(
      page.getByRole("heading", { name: "COMPLIANCE LEDGER" }),
    ).toBeVisible();

    // Click back to Home
    await page.getByRole("button", { name: "[ HOME ]" }).click();
    await expect(page.getByText("LAUNCH CFO DASHBOARD")).toBeVisible();
  });
});
