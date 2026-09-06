import { test, expect } from "@playwright/test";

test.describe("Settings — Save/Reset actually persist", () => {
  test("changing shift start hour, saving, and reloading keeps the new value", async ({ page }) => {
    await page.goto("/settings");
    const startInput = page.locator("input").first();
    await startInput.fill("6");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.locator("input").first()).toHaveValue("6");
  });

  test("Reset to Defaults restores the shipped default and persists across reload", async ({ page }) => {
    await page.goto("/settings");
    const startInput = page.locator("input").first();
    await startInput.fill("9");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.getByRole("button", { name: "Reset to Defaults" }).click();
    await expect(startInput).toHaveValue("7");

    await page.reload();
    await expect(page.locator("input").first()).toHaveValue("7");
  });

  test("a saved shift boundary actually changes the Shift range elsewhere in the app", async ({ page }) => {
    await page.goto("/settings");
    await page.locator("input").first().fill("0");
    await page.locator("input").nth(1).fill("23");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.goto("/equipment/air-blower");
    await page.getByRole("button", { name: "Shift" }).click();
    const contextLabel = page.locator(".range-context");
    // With 0-23 boundaries the whole day is "Day" shift, which should
    // surface in the context label once Shift is selected.
    await expect(contextLabel).toContainText("Day shift 00:00");
  });
});
