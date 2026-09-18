import { test, expect } from "@playwright/test";
for (const [id, label, value] of [
  ["air-blower", "Configuration Settings Motor Voltage V", "4100"],
  ["fired-heater", "Configuration Radiation Loss Pct", "2"],
  ["shell-tube-exchanger", "Configuration Area M2", "130"],
  ["membrane-analyzer", "Configuration Design Feed Pressure Kpag", "16000"],
]) {
  test(
    id + " YTD, configuration persistence, table/export and chart controls",
    async ({ page }) => {
      await page.goto("/equipment/" + id);
      await expect(page.locator(".asset-fresh")).toContainText("Simulated YTD");
      await page.getByRole("button", { name: "YTD", exact: true }).click();
      await expect(
        page.getByText(/Available in window: 6233 observations/),
      ).toBeVisible();
      await page.getByRole("button", { name: "24H", exact: true }).click();
      await expect(
        page.getByText(/Available in window: 25 observations/),
      ).toBeVisible();
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page
        .getByRole("button", { name: "Reset view", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Data & Log", exact: true })
        .click();
      await expect(
        page.getByRole("region", {
          name: "Selected observation window",
          exact: true,
        }),
      ).toContainText("25 rows");
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export selected results", exact: true })
        .click();
      const stream = await (await download).createReadStream();
      let csv = "";
      for await (const c of stream!) csv += c.toString();
      expect(csv.trim().split(/\r?\n/)).toHaveLength(26);
      await page
        .getByRole("button", { name: "Configuration", exact: true })
        .click();
      await page.getByText("Edit configuration", { exact: true }).click();
      if (id === "air-blower")
        await page
          .locator("summary")
          .filter({ hasText: /^Settings$/ })
          .click();
      await page.getByLabel(label, { exact: true }).fill(value);
      await page
        .getByRole("button", { name: "Save configuration", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("Saved");
      await page.reload();
      await page
        .getByRole("button", { name: "Configuration", exact: true })
        .click();
      await page.getByText("Edit configuration", { exact: true }).click();
      if (id === "air-blower")
        await page
          .locator("summary")
          .filter({ hasText: /^Settings$/ })
          .click();
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
    },
  );
}
test("predictor YTD history is separate from projection horizon", async ({
  page,
}) => {
  await page.goto("/predictors/furnace-skin-temp");
  await page.getByRole("button", { name: "YTD", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Projection horizon", exact: true })
    .selectOption("7");
  await page.getByRole("button", { name: "Data & Log", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Observed furnace history", exact: true }),
  ).toContainText("1559 rows");
  const d = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export displayed forecast", exact: true })
    .click();
  const stream = await (await d).createReadStream();
  let csv = "";
  for await (const c of stream!) csv += c.toString();
  expect(csv).toContain("2026-09-18");
  await page.getByRole("button", { name: "24H", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Observed furnace history", exact: true }),
  ).toContainText("7 rows");
});
test("financial YTD totals reconcile and recalculate from OPEX", async ({
  page,
}) => {
  await page.goto("/crude-to-profit");
  const history = page.getByRole("region", {
    name: "Simulated economics history",
    exact: true,
  });
  const totals = history.getByRole("region", {
    name: "Selected period totals (CAD)",
    exact: true,
  });
  await expect(totals.locator("tbody td")).toHaveCount(4);
  const read = async () =>
    (await totals.locator("tbody td").allTextContents()).map((t) =>
      Number(t.replaceAll(",", "")),
    );
  const before = await read();
  expect(before[3]).toBeCloseTo(before[0] - before[1] - before[2], 2);
  await page
    .getByLabel("OPEX (% of sales revenue)", { exact: true })
    .fill("10");
  const after = await read();
  expect(after[0]).toBe(before[0]);
  expect(after[2]).toBeCloseTo(after[0] * 0.1, 2);
  await history.getByRole("button", { name: "24H", exact: true }).click();
  const shorter = await read();
  expect(shorter[0]).toBeLessThan(after[0]);
  expect(shorter[3]).toBeCloseTo(shorter[0] - shorter[1] - shorter[2], 2);
});

test("predictor model configuration validates, recalculates and persists", async ({
  page,
}) => {
  const { readFileSync } = await import("node:fs");
  const bundle = JSON.parse(
    readFileSync("public/data/furnace-skin-temp-model.json", "utf8"),
  );
  bundle.version = "local-review-test";
  bundle.alarm_threshold_c = 474;
  await page.goto("/predictors/furnace-skin-temp");
  await page.getByRole("button", { name: "Data & Log", exact: true }).click();
  await page.getByText("Replace model (advanced)", { exact: true }).click();
  await page
    .getByLabel("Import model JSON")
    .setInputFiles({
      name: "model.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(bundle)),
    });
  await expect(
    page.getByText("Validated model saved locally.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Engineering manual", exact: true })
    .click();
  await expect(page.getByText(/Current model local-review-test/)).toContainText(
    "474",
  );
});
