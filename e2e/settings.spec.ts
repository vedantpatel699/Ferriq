import { test, expect } from "@playwright/test";

test.describe("Settings — Save/Reset actually persist", () => {
  test("changing shift start hour, saving, and reloading keeps the new value", async ({
    page,
  }) => {
    await page.goto("/settings");
    const startInput = page.locator("input").first();
    await startInput.fill("6");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    await expect(page.getByRole("status")).toBeVisible();

    await page.reload();
    await expect(page.locator("input").first()).toHaveValue("6");
  });

  test("Reset to Defaults restores the shipped default and persists across reload", async ({
    page,
  }) => {
    await page.goto("/settings");
    const startInput = page.locator("input").first();
    await startInput.fill("9");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("status")).toContainText("saved");

    await page.getByRole("button", { name: "Reset to Defaults" }).click();
    await expect(startInput).toHaveValue("7");

    await page.reload();
    await expect(page.locator("input").first()).toHaveValue("7");
  });

  test("a saved shift boundary actually changes the Shift range elsewhere in the app", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.locator("input").first().fill("0");
    await page.locator("input").nth(1).fill("23");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("status")).toContainText("saved");

    await page.goto("/equipment/air-blower");
    await page.getByRole("button", { name: "Shift" }).click();
    const contextLabel = page.locator(".range-context");
    // With 0-23 boundaries the whole day is "Day" shift, which should
    // surface in the context label once Shift is selected.
    await expect(contextLabel).toContainText("Day shift 00:00");
  });
});

test('stale drafts cannot overwrite another tab and repeated saves work',async({page,context})=>{await page.goto('/settings');const other=await context.newPage();await other.goto('/settings');await other.locator('input').first().fill('9');await page.locator('input').first().fill('6');await page.getByRole('button',{name:'Save Changes'}).click();await expect(page.getByRole('status')).toContainText('saved');await page.locator('input').first().fill('5');await page.getByRole('button',{name:'Save Changes'}).click();await expect(page.getByRole('status')).toContainText('saved');await other.getByRole('button',{name:'Save Changes'}).click();await expect(other.getByRole('status')).toContainText('changed in another tab');await other.reload();await expect(other.locator('input').first()).toHaveValue('5');});
