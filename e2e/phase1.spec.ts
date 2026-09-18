import { test, expect } from "@playwright/test";

test("OPEX updates reconciliation, saves, exports and reports without changing revenue", async ({
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
  await page.getByText("Operating costs", { exact: true }).click();
  await page.getByLabel("Electricity cost basis").selectOption("hourly");
  await page
    .getByLabel("Electricity Consumption (kWh/h)", { exact: true })
    .fill("1000");
  await page
    .getByLabel("Electricity Rate (CAD/kWh)", { exact: true })
    .fill("0.1");
  await page
    .getByLabel("Maintenance Budget (CAD/year)", { exact: true })
    .fill("1000000");
  const after = await read();
  expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
  expect(after[3]).toBe(1.792);
  expect(after[4]).toBeCloseTo(after[2] - 1.792, 3);
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
  expect(JSON.parse(json).results.economics.operating_costs.annualCad).toBe(
    1792000,
  );
  await page.getByRole("button", { name: "Build Report", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview report", exact: true })
    .click();
  await expect(page.locator(".report-document")).toContainText(
    "margin after configured OPEX",
  );
  await page.keyboard.press("Escape");
  await page.getByText("Operating costs", { exact: true }).click();
  await page
    .getByLabel("Electricity Rate (CAD/kWh)", { exact: true })
    .fill("-1");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(table).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save scenario", exact: true }),
  ).toBeDisabled();
});

test("all furnace passes expose trained predictions separately from timestamp-based trends", async ({
  page,
}) => {
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
      if (furnace !== "heater_1")
        await expect(
          page.getByText(
            /Projection starts at the last available pass observation/,
          ),
        ).toBeVisible();
    }
  }
});
