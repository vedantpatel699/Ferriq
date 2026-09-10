import { test, expect } from "@playwright/test";

test("three technologies and three price cases use a read-only source snapshot", async ({
  page,
}) => {
  await page.goto("/crude-to-profit");
  await expect(
    page.getByText("The data were obtained from open resources.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Configuration", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Detailed results", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Live market case", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Live market uses published estimates/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Annual estimate", exact: true }),
  ).toBeVisible();
  const margins = page.locator(".metrics-grid");
  await expect(margins).toContainText("million CAD/year");
  await expect(margins).toContainText("Annual sales revenue");
  await expect(margins.locator(".metric-value").first()).toHaveText(
    "1,787.39 million CAD/year",
  );
  const initial = (await margins.textContent())!;
  await page
    .getByLabel("Technology", { exact: true })
    .selectOption("delayed_coker");
  await expect(margins).not.toHaveText(initial);
  await page.getByLabel("Technology", { exact: true }).selectOption("fcc");
  await expect(page.getByText(/FCC converts gas oil/)).toBeVisible();
  await page.getByLabel("Technology", { exact: true }).selectOption("lc_finer");
  await expect(margins).toHaveText(initial);
  await page.screenshot({
    path: test.info().outputPath("crude-overview.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Price snapshot", exact: true })
    .click();
  await expect(page.getByText(/USD\/CAD:/)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(2);
  await expect(page.locator("input")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reload published prices" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reload published prices" }).click();
  await expect(
    page.getByText(/Latest published snapshot loaded/),
  ).toBeVisible();
});

test("unavailable or incomplete market data never replaces fixed cases", async ({
  page,
}) => {
  await page.route("**/data/crude-market-prices.json", (route) =>
    route.fulfill({ json: { crude: { OSH: 0 } } }),
  );
  await page.goto("/crude-to-profit");
  await expect(page.getByText(/Price refresh unavailable/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Low case", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "High case", exact: true }),
  ).toBeVisible();
  const market = page.locator(".metric-card").filter({
    has: page.getByRole("heading", { name: "Live market case", exact: true }),
  });
  await expect(market).toContainText("—");
});
