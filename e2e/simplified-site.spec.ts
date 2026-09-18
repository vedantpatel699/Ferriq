import { test, expect } from "@playwright/test";

test("overview contains only six model tiles", async ({ page }) => {
  await page.goto("/");
  const main = page.locator("#main-content");
  await expect(main.locator(".model-tile")).toHaveCount(6);
  const names = [
    "Air Blower",
    "Fired Heater",
    "Shell & Tube Exchanger",
    "Membrane Analyzer",
    "Furnace Skin TI Predictor",
    "Crude to Profit",
  ];
  expect(await main.locator(".model-tile").allTextContents()).toEqual(names);
  await expect(
    main.locator("table, canvas, .metric-value, .status-pill, article, p"),
  ).toHaveCount(0);
  for (const name of names) {
    await main.getByRole("link", { name, exact: true }).click();
    await expect(
      main.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    expect(await main.innerText()).not.toMatch(
      /\b(?:C|H|E|M)-\d{3}|\b\d{4,6}-(?:PI|TI|FIC|PIC|HS|VI|PDI)-|\b(?:BL|BU)301/,
    );
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Overview", exact: true })
      .click();
  }
});

test("removed pages are unavailable at their direct URLs", async ({ page }) => {
  for (const route of [
    "watchlist",
    "settings",
    "data-export",
    "activity-log",
    "help",
    "dashboards",
    "predictors",
  ]) {
    await page.goto("/" + route);
    await expect(
      page.getByRole("heading", { name: "Page not found", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(
        "#main-content button, #main-content input, #main-content table",
      ),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Return to overview" }).click();
    await expect(page.locator(".model-tile")).toHaveCount(6);
  }
});
