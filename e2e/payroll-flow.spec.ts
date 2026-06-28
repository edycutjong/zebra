import { test, expect } from "@playwright/test";

test.describe("Zebra Core Payroll Flow", () => {
  test("should execute full payroll workflow in demo mode", async ({
    page,
  }) => {
    // 1. Load application
    await page.goto("/");

    // 2. Navigate to CFO portal
    await page.getByRole("button", { name: "[ CFO PORTAL ]" }).click();
    await expect(page.getByText("CFO PAYROLL DISBURSEMENT")).toBeVisible();

    // 3. Connect Freighter Wallet simulation
    const connectBtn = page.getByRole("button", { name: /CONNECT FREIGHTER/i });
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();
    await expect(page.getByText("GB3Z...ZEBRA")).toBeVisible();

    // 4. Load mock CSV data
    const mockCsvBtn = page.getByRole("button", {
      name: /Use Mock Payroll CSV Data/i,
    });
    await expect(mockCsvBtn).toBeVisible();
    await mockCsvBtn.click();

    // Verify CSV loaded confirmation and employee record lines
    await expect(
      page.getByText("CSV Data Ingested Successfully"),
    ).toBeVisible();
    await expect(page.getByText("Alice Smith")).toBeVisible();
    await expect(page.getByText("Bob Jones")).toBeVisible();
    await expect(page.getByText("Charlie Brown")).toBeVisible();
    await expect(page.getByText("Dave Wilson")).toBeVisible();

    // 5. Compile ZK Proof
    const compileBtn = page.getByRole("button", { name: /COMPILE ZK PROOF/i });
    await expect(compileBtn).toBeVisible();
    await compileBtn.click();

    // Wait for proof compilation steps (progress bar reaches 100%)
    // The proof generation sequence takes ~4 seconds in simulation steps (4 * 1000ms)
    // Playwright will automatically wait/re-try check up to 10 seconds.
    await expect(
      page.getByText("UltraHonk Proof Generated", { exact: false }),
    ).toBeVisible({ timeout: 10000 });

    // 6. Sign and Execute
    const executeBtn = page.getByRole("button", {
      name: /SIGN & EXECUTE PAYROLL/i,
    });
    await expect(executeBtn).toBeVisible();
    await executeBtn.click();

    // Check consensus success
    await expect(page.getByText("Payroll Executed")).toBeVisible();
    await expect(page.getByText("Stellar Consensus")).toBeVisible();
    await expect(page.getByText("SUCCESS", { exact: true })).toBeVisible();
  });
});
