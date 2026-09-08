import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/watchlist",
  "/dashboards",
  "/predictors",
  "/equipment/air-blower",
  "/equipment/fired-heater",
  "/equipment/shell-tube-exchanger",
  "/equipment/membrane-analyzer",
  "/predictors/furnace-skin-temp",
  "/crude-to-profit",
  "/settings",
  "/help",
];

test.describe("Every route renders with no console errors", () => {
  for (const route of ROUTES) {
    test(`route ${route}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);
      expect(
        errors,
        `console errors on ${route}: ${errors.join("; ")}`,
      ).toHaveLength(0);
    });
  }
});

test("sidebar nav actually navigates to every linked page (no href=# / dead links)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("nav.sidebar")).toBeVisible();
  const links = await page.locator("nav.sidebar a.navlink").all();
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    const href = await link.getAttribute("href");
    expect(
      href,
      "every sidebar nav link must have a real href, never #",
    ).not.toBe("#");
    expect(href).not.toBeNull();
    await link.click();
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      href,
    );
  }
});

test("breadcrumb Home link on an equipment page returns to Home", async ({
  page,
}) => {
  await page.goto("/equipment/air-blower");
  await page.getByRole("link", { name: "Home" }).first().click();
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname).toBe("/");
});
