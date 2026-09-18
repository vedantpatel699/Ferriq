import { test, expect } from "@playwright/test";

test("mobile keyboard navigation closes the menu and focuses the destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const link = page.getByRole("navigation").getByRole("link", { name: "Crude to Profit", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveTitle("Crude to Profit | Ferriq");
  await page.locator("#main-content").evaluate(el => el.scrollTo(0, 800));
  const menu = await page.getByRole("button", { name: "Menu", exact: true }).boundingBox();
  const content = await page.locator("#main-content").boundingBox();
  expect(content!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height);
  await page.goBack();
  await expect(page.locator("#main-content")).toBeFocused();
});

test("all six dashboards fit a 320 CSS-pixel viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ["/equipment/air-blower", "/equipment/fired-heater", "/equipment/shell-tube-exchanger", "/equipment/membrane-analyzer", "/predictors/furnace-skin-temp", "/crude-to-profit"]) {
    await page.goto(route);
    await expect(page.locator("#main-content h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    expect(await page.locator("#main-content").evaluate(el => el.scrollWidth <= el.clientWidth + 1), route).toBe(true);
  }
});

test("failed published data load has a working retry", async ({ page }) => {
  await page.route("**/data/workspace.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("could not be loaded");
  await page.unroute("**/data/workspace.json");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("#main-content h1")).toBeVisible();
});

test("unknown routes offer a usable return to overview", async ({ page }) => {
  await page.goto("/missing-dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Return to overview" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#main-content")).toBeFocused();
});
