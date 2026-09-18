import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const printed = JSON.parse(readFileSync("submission/sudhakar/tests/manual-content.json", "utf8"));

for (const [route, title] of [
  ["equipment/air-blower", "Air Blower"],
  ["equipment/fired-heater", "Fired Heater"],
  ["equipment/shell-tube-exchanger", "Shell & Tube Exchanger"],
  ["equipment/membrane-analyzer", "Hydrogen Membrane"],
  ["predictors/furnace-skin-temp", "Furnace Skin Temperature"],
  ["crude-to-profit", "Crude to Profit"],
])
  test(`${title} manual has readable inputs, calculations and trends`, async ({
    page,
  }) => {
    await page.goto(`/${route}`);
    await page
      .getByRole("button", { name: "Engineering manual", exact: true })
      .click();
    const manual = page.locator(".reference-manual").first();
    await expect(
      manual.getByRole("heading", { name: `${title} engineering manual` }),
    ).toBeVisible();
    for (const name of [
      "Inputs and units",
      "Calculations",
      "Useful trends",
      "Assumptions and limits",
      "Sources",
    ])
      await expect(
        manual.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    await expect(manual.locator(".formula-expression").first()).toBeVisible();
    const snapshot = printed.find((m: { id: string }) => m.id === route.split('/').at(-1));
    expect(await manual.locator('.formula-expression').allTextContents()).toEqual(snapshot.formulas);
    expect(await manual.innerText()).toBe(snapshot.text);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
