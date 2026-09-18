import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function checkAccessibility(page: import("@playwright/test").Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    scan.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}
test("report feature is removed from all six models", async ({ page }) => {
  for (const route of [
    "equipment/air-blower",
    "equipment/fired-heater",
    "equipment/shell-tube-exchanger",
    "equipment/membrane-analyzer",
    "predictors/furnace-skin-temp",
    "crude-to-profit",
  ]) {
    await page.goto("/" + route);
    await expect(page.locator("#main-content h1")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Build Report", exact: true }),
    ).toHaveCount(0);
  }
});

test("Pass 3 scenario applies only on run, resets and labels uncertainty", async ({
  page,
}, info) => {
  await page.goto("/predictors/furnace-skin-temp?furnace=heater_1&pass=3");
  const work = page.getByRole("region", {
    name: "Pass 3 what-if workspace",
    exact: true,
  });
  const slider = page.getByRole("slider", { name: /Pass 3 flow split/ });
  await expect(slider).toBeVisible();
  const initial = Number(await slider.inputValue());
  await slider.fill(String(Math.round((initial - 2.5) * 10) / 10));
  await expect(work).toContainText("Slider changed");
  await expect(
    page.getByLabel("POC simulated scenario", { exact: true }),
  ).toHaveCount(0);
  await work.getByRole("button", { name: "Run scenario", exact: true }).click();
  await expect(
    page.getByLabel("POC simulated scenario", { exact: true }),
  ).toBeChecked();
  await expect(work).toContainText("No intervention effect has been validated");
  await expect(work).toContainText("Illustrative 24 h TI change");
  await page.screenshot({
    path: info.outputPath("scenario.png"),
    fullPage: true,
  });
  await checkAccessibility(page);
  await slider.fill((await slider.getAttribute("max")) ?? "1");
  await expect(work).toContainText("Outside observed history range");
  await work
    .getByRole("button", { name: "Reset scenario", exact: true })
    .click();
  expect(Number(await slider.inputValue())).toBeCloseTo(initial, 1);
  await expect(
    page.getByLabel("POC simulated scenario", { exact: true }),
  ).toHaveCount(0);
});
test("local configuration saves work offline and versions remain inspectable", async ({
  page,
  context,
}) => {
  await page.goto("/equipment/air-blower");
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page.getByText("Edit configuration", { exact: true }).click();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Save configuration", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await context.setOffline(false);
  await page.goto("/data-export");
  await page
    .getByLabel("Inspect local resource versions", { exact: true })
    .selectOption("air-blower");
  await expect(
    page.getByRole("region", {
      name: "Retained local resource versions",
      exact: true,
    }),
  ).toBeVisible();
});

test("backup conflicts roll back every resource in the restore", async ({
  page,
}) => {
  await page.goto("/data-export");
  await expect(
    page.getByRole("heading", { name: "Database & change log", exact: true }),
  ).toBeVisible();
  const resources = await page.evaluate(async () => {
    const w = await (await fetch("/data/workspace.json")).json();
    return ["air-blower", "settings"].map((key) =>
      w.resources.find((r: { key: string }) => r.key === key),
    );
  });
  await page
    .getByLabel("Import workspace backup", { exact: true })
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "ferriq-workspace-v1", resources }),
      ),
    });
  await expect(
    page.getByRole("button", { name: "Apply backup locally", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (resource) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("ferriq-workspace", 1);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("resources", "readwrite");
        tx.objectStore("resources").put({ ...resource, version: 99 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  }, resources[1]);
  await page
    .getByRole("button", { name: "Apply backup locally", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "changed in another tab",
  );
  const saved = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const r = indexedDB.open("ferriq-workspace", 1);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction("resources")
              .objectStore("resources")
              .get("air-blower");
          q.onsuccess = () => {
            db.close();
            resolve(q.result ?? null);
          };
        };
      }),
  );
  expect(saved).toBeNull();
});
