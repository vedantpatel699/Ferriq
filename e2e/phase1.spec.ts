import { test, expect } from "@playwright/test";

test("OPEX updates reconciliation, saves and exports without changing revenue", async ({
  page,
}) => {
  await page.goto("/crude-to-profit");
  const table = page.getByRole("region", {
    name: "Annual profit reconciliation (million CAD/year)",
    exact: true,
  });
  const row = table.locator("tbody tr").first();
  await expect(row.locator("td")).toHaveCount(6);
  const read = async () =>
    (await row.locator("td").allTextContents())
      .slice(1)
      .map((s) => Number(s.replaceAll(",", "")));
  const before = await read();
  const percentage = page.getByLabel("OPEX (% of sales revenue)", {
    exact: true,
  });
  await expect(percentage).toHaveValue("8");
  expect(before[3]).toBeCloseTo(before[0] * 0.08, 3);
  await percentage.fill("10");
  const after = await read();
  expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
  expect(after[3]).toBeCloseTo(after[0] * 0.1, 3);
  expect(after[4]).toBeCloseTo(after[2] - after[3], 3);
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(
    page.getByText("Scenario saved in this browser.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(table).toBeVisible();
  expect(await read()).toEqual(after);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export scenario & results", exact: true })
    .click();
  const file = await download;
  const stream = await file.createReadStream();
  let json = "";
  for await (const chunk of stream!) json += chunk.toString();
  const exported = JSON.parse(json);
  expect(
    exported.results.economics.operating_costs.annualCad / 1e6,
  ).toBeCloseTo(after[3], 3);
  await expect(percentage).toHaveValue("10");
  await percentage.fill("101");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(table).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save scenario", exact: true }),
  ).toBeDisabled();
});

test("all furnace passes expose trained predictions separately from timestamp-based trends", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const [furnace, count] of [
    ["heater_1", 4],
    ["heater_2", 4],
    ["heater_3", 1],
  ] as const) {
    for (let pass = 1; pass <= count; pass++) {
      await page.goto(
        `/predictors/furnace-skin-temp?furnace=${furnace}&pass=${pass}`,
      );
      await expect(
        page.getByRole("region", {
          name: "Trained-horizon predictions by thermocouple (°C)",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /The trend is a linear projection without a calibrated prediction interval/,
        ),
      ).toBeVisible();
      await expect(page.locator(".asset-fresh")).toContainText(
        "Sep 17, 2026 17:00",
      );
      await expect(page.getByText(/Incomplete pass coverage/)).toHaveCount(0);
    }
  }
});
