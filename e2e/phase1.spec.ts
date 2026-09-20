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
  const breakdown = page.getByRole("region", {
    name: "Operating cost breakdown (million CAD/year)",
    exact: true,
  });
  await expect(breakdown.locator("tbody tr")).toHaveCount(12);
  for (const label of [
    "Steam",
    "Power",
    "Natural gas",
    "Chemicals + catalyst",
  ]) {
    await expect(
      page.getByLabel(`${label} (% of sales revenue)`, { exact: true }),
    ).toHaveValue("2");
  }
  const percentage = page.getByLabel("Steam (% of sales revenue)", {
    exact: true,
  });
  await expect(percentage).toHaveValue("2");
  expect(before[3]).toBeCloseTo(before[0] * 0.08, 3);
  await percentage.fill("4");
  const after = await read();
  expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
  expect(after[3]).toBeCloseTo(after[0] * 0.1, 3);
  expect(after[4]).toBeCloseTo(after[2] - after[3], 3);
  const componentRows = await breakdown.locator("tbody tr").all();
  for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let i = 0; i < 4; i++)
      sum += Number(
        (
          await componentRows[c * 4 + i].locator("td").last().innerText()
        ).replaceAll(",", ""),
      );
    const caseTotal = Number(
      (
        await table.locator("tbody tr").nth(c).locator("td").nth(4).innerText()
      ).replaceAll(",", ""),
    );
    expect(sum).toBeCloseTo(caseTotal, 3);
  }
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
  await expect(percentage).toHaveValue("4");
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
