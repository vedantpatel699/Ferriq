import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  calculateHydrogen,
  feedPreset,
  PROFILES,
  MOLAR_VOLUME,
} from "../src/engineering/hydrogen";

test("six combinations, editing, recalculation, restore and saved scenario", async ({
  page,
}) => {
  await page.goto("/hydrogen-production");
  const heading = page.getByRole("heading", {
    name: "Hydrogen product after PSA",
    exact: true,
  });
  const card = heading.locator("..");
  const format = (n: number) =>
    n.toLocaleString("en-CA", { maximumFractionDigits: 2 });
  for (const feedCase of ["A", "B"] as const)
    for (let profile = 0; profile < 3; profile++) {
      await page
        .getByLabel("Feed scenario", { exact: true })
        .selectOption(feedCase);
      await page
        .getByLabel("Conversion profile", { exact: true })
        .selectOption(String(profile));
      await expect(
        page.getByLabel("Natural gas flow (Sm³/h)", { exact: true }),
      ).toHaveValue(String(feedPreset(feedCase)[1].flow));
      await expect(card).toContainText("—");
      await page
        .getByRole("button", { name: "Recalculate", exact: true })
        .click();
      const t = calculateHydrogen({
        feedCase,
        profile,
        feeds: feedPreset(feedCase),
        settings: { ...PROFILES[profile] },
      }).totals;
      await expect(card).toContainText(format(t.productH2 * MOLAR_VOLUME));
      await expect(
        page
          .getByRole("heading", { name: "CO₂ generated", exact: true })
          .locator(".."),
      ).toContainText(format(t.generatedCO2 * 0.044));
      await expect(
        page
          .getByRole("heading", {
            name: "Reaction water consumption",
            exact: true,
          })
          .locator(".."),
      ).toContainText(format(t.water * 0.018));
    }
  await page.getByText("Calculation settings", { exact: true }).click();
  await expect(
    page.getByLabel("Shift CO conversion (%)", { exact: true }),
  ).toHaveValue("74.797917");
  await page.getByLabel("PSA hydrogen recovery (%)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Recalculate", exact: true }).click();
  await expect(card.locator(".hydrogen-value")).toHaveText("0 Sm³/h");
  await page
    .getByRole("button", { name: "Restore profile", exact: true })
    .click();
  await page
    .getByLabel("Natural gas flow (Sm³/h)", { exact: true })
    .fill("60000");
  await page.getByRole("button", { name: "Recalculate", exact: true }).click();
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(
    page.getByText("Scenario saved in this browser.", { exact: true }),
  ).toBeVisible();
  const saved = await card.innerText();
  await page.reload();
  await expect(
    page.getByLabel("Natural gas flow (Sm³/h)", { exact: true }),
  ).toHaveValue("60000");
  await expect(card).toHaveText(saved, { useInnerText: true });
  await page.getByText("Results by feed", { exact: true }).click();
  await expect(
    page
      .getByRole("region", {
        name: "Calculated feed contributions",
        exact: true,
      })
      .locator("tbody tr"),
  ).toHaveCount(8);
  await page
    .getByRole("button", { name: "Restore feed preset", exact: true })
    .click();
  await expect(
    page.getByLabel("Natural gas flow (Sm³/h)", { exact: true }),
  ).toHaveValue("62424");
});

test("invalid inputs hide results; settings omit gas conditions; manual explains assumptions", async ({
  page,
}) => {
  await page.goto("/hydrogen-production");
  await page
    .getByLabel("Chemical feed gas H2 (mol%)", { exact: true })
    .fill("");
  await expect(
    page.getByRole("button", { name: "Recalculate", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("composition");
  await expect(page.locator(".hydrogen-value").first()).toContainText("—");
  await page
    .getByRole("button", { name: "Restore feed preset", exact: true })
    .click();
  await page.getByText("Calculation settings", { exact: true }).click();
  await page
    .getByLabel("Reformer carbon converted to CO (%)", { exact: true })
    .fill("90");
  await expect(page.getByRole("alert")).toContainText(
    "total no more than 100%",
  );
  await expect(
    page.getByText("Standard gas conditions", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Engineering manual", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Standard gas conditions", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".reference-manual")).toContainText(
    "101.325 kPa absolute",
  );
  await expect(page.locator(".reference-manual")).toContainText(
    "Dataset 2 shift correction",
  );
  await expect(
    page.getByText("Run the Python model", { exact: true }),
  ).toHaveCount(0);
});

test("storage failures, accessibility and narrow-screen layout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ferriq.hydrogen.scenario.v1", '{"invalid":true}');
  });
  await page.goto("/hydrogen-production");
  await expect(page.getByRole("status")).toContainText("could not be loaded");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("could not be saved");
  expect(
    (await new AxeBuilder({ page }).include(".hydrogen-page").analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Show remaining components", exact: true })
    .click();
  await expect(
    page.getByLabel("Natural gas C6H14 (mol%)", { exact: true }),
  ).toHaveCount(1);
});
