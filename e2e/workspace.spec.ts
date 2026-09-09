import { test, expect } from "@playwright/test";
test("fixed navigation and narrow layout", async ({ page }, testInfo) => {
  await page.goto("/equipment/air-blower");
  await expect(
    page.getByRole("heading", { name: "Air Blower", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("blower-desktop.png") });
  const before = await page.locator("nav.sidebar").boundingBox();
  await page.locator("#main-content").evaluate((el) => el.scrollTo(0, 1000));
  expect((await page.locator("nav.sidebar").boundingBox())?.y).toBe(before?.y);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("link", { name: "Crude to Profit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Crude to Profit", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("economics-mobile.png") });
});
test("all furnace passes, holdout data and manuals work", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/predictors/furnace-skin-temp");
  await page
    .getByRole("combobox", { name: "Furnace", exact: true })
    .selectOption("heater_2");
  await page
    .getByRole("combobox", { name: "Pass", exact: true })
    .selectOption("4");
  await expect(page.locator(".asset-meta")).toContainText("Pass 4");
  await page
    .getByRole("button", { name: "Drivers & validation", exact: true })
    .click();
  await expect(
    page.getByText("Original model holdout metrics", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Observed operating driver", exact: true })
      .getByRole("img"),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("furnace-validation.png"),
  });
  await page
    .getByRole("button", { name: "Engineering manual", exact: true })
    .click();
  await expect(page.locator(".reference-manual")).toBeVisible();
  expect(errors).toEqual([]);
});
test("CSV import, local persistence and backup export", async ({ page }) => {
  await page.goto("/equipment/fired-heater");
  await page.getByRole("button", { name: "Data & Log", exact: true }).click();
  await page.getByText("Replace input data", { exact: true }).click();
  await page.getByLabel("Import input CSV").setInputFiles({
    name: "heater.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,fuelFlowKgS,stackTempC,combustionAirTempC,fuelTempC,processFlowKgS,processInC,processOutC,processCpKjKgK,stackO2Pct,bridgewallAC,bridgewallBC\n2026-09-01T07:00:00,1,300,20,20,25,100,200,2,3,600,600",
    ),
  });
  await page.getByRole("button", { name: "Apply imported dataset" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.locator(".asset-fresh")).toContainText("heater.csv");
  await page.goto("/data-export");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace backup" }).click();
  expect((await download).suggestedFilename()).toBe("ferriq-workspace.json");
});
test("invalid economics inputs block results and snapshots require deliberate apply", async ({
  page,
}) => {
  await page.goto("/crude-to-profit");
  await page.getByText("Adjust scenario", { exact: true }).click();
  await page.getByLabel("OSH (m³/h)", { exact: true }).fill("-1");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save scenario" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Discard draft changes" }).click();
  await expect(
    page.getByRole("button", { name: "Save scenario" }),
  ).toBeEnabled();
});

test("six vital dashboards keep engineering edits collapsed until requested", async ({
  page,
}) => {
  for (const id of [
    "air-blower",
    "fired-heater",
    "shell-tube-exchanger",
    "membrane-analyzer",
  ]) {
    await page.goto("/equipment/" + id);
    await page.getByRole("button", { name: "Advanced", exact: true }).click();
    const panel = page
      .locator("details")
      .filter({
        has: page.getByText("Edit engineering configuration", { exact: true }),
      });
    await expect(panel).not.toHaveAttribute("open", "");
    await expect(panel.locator("input:visible")).toHaveCount(0);
    await page
      .getByText("Edit engineering configuration", { exact: true })
      .click();
    await expect(panel).toHaveAttribute("open", "");
  }
  await page.goto("/predictors/furnace-skin-temp");
  await page.getByRole("button", { name: "Data & Log", exact: true }).click();
  await expect(page.getByLabel("Import model JSON")).toBeHidden();
  await page.goto("/crude-to-profit");
  await expect(page.getByLabel("OSH (m³/h)", { exact: true })).toBeHidden();
  await page.getByText("Adjust scenario", { exact: true }).click();
  await expect(page.getByLabel("OSH (m³/h)", { exact: true })).toBeVisible();
});
