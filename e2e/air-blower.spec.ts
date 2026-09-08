import { test, expect } from "@playwright/test";

test.describe("Air Blower — time range, chart, and Calculation basis dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/equipment/air-blower");
  });

  test("Shift/24H/7D pills change the active pill and the rendered chart data", async ({
    page,
  }) => {
    const chart = page.locator(".chart-echart");
    await expect(chart).toBeVisible();

    const pill24h = page.getByRole("button", { name: "24H" });
    const pill7d = page.getByRole("button", { name: "7D" });

    await pill24h.click();
    await expect(pill24h).toHaveClass(/active/);
    const canvasAfter24h = await chart.screenshot();

    await pill7d.click();
    await expect(pill7d).toHaveClass(/active/);
    await expect(pill24h).not.toHaveClass(/active/);
    const canvasAfter7d = await chart.screenshot();

    // A time-pill change with no visual difference at all would indicate
    // the underlying data didn't actually change (the exact failure mode
    // called out in the spec: "a time pill changing color without
    // changing the underlying data is NOT a successful implementation").
    expect(Buffer.compare(canvasAfter24h, canvasAfter7d)).not.toBe(0);
  });

  test("Custom range opens a popover with date/time inputs and Apply wires it in", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Custom" }).click();
    const panel = page.locator(".custom-panel");
    await expect(panel).toBeVisible();
    const inputs = panel.locator("input[type='datetime-local']");
    await expect(inputs).toHaveCount(2);
    await inputs.nth(0).fill("2025-12-16T00:00");
    await inputs.nth(1).fill("2026-01-05T00:00");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(panel).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Custom" })).toHaveClass(
      /active/,
    );
  });

  test("Calculation basis & references opens a real dialog with formula content, and closes", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Calculation basis & references" })
      .click();
    const dialog = page.locator("dialog.drawer");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("ASME PTC 10");
    await expect(dialog).toContainText("Polytropic efficiency");
    await page.locator(".drawer-close").click();
    await expect(dialog).not.toBeVisible();
  });

  test("key metrics show real computed values, not placeholders", async ({
    page,
  }) => {
    const scorecard = page.getByRole("region", {
      name: "Asset health metrics",
      exact: true,
    });
    await expect(scorecard).toBeVisible();
    await expect(scorecard).toContainText("71.84");
    await expect(scorecard).toContainText("Missing");
    await page
      .getByRole("button", { name: "All metrics", exact: true })
      .click();
    await expect(scorecard).toContainText("685.24");
  });
});
