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
test("POC comparison, quality and printable report", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/equipment/air-blower");
  await page.getByText("POC demo data", { exact: true }).click();
  await page
    .getByRole("button", { name: "Load current POC demo", exact: true })
    .click();
  const score = page.getByRole("region", {
    name: "Asset health scorecard",
    exact: true,
  });
  await expect(score).toContainText("71.8");
  await expect(score).toContainText("82 / 100");
  await page.getByRole("button", { name: "Compare: Off", exact: true }).click();
  await expect(score).toContainText("B: 100");
  await expect(
    score.getByRole("columnheader", { name: "Δ avg", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("B clean-filter baseline", { exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: info.outputPath("comparison.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Build Report", exact: true }).click();
  const report = page.getByRole("dialog", {
    name: "Build report",
    exact: true,
  });
  await expect(report).toHaveAttribute("aria-modal", "false");
  await report
    .getByLabel("Engineer notes", { exact: true })
    .fill(
      "Client review: compare bearing trend against the simulated baseline.",
    );
  await report
    .getByRole("button", { name: "Preview report", exact: true })
    .click();
  await expect(
    report.getByRole("heading", { name: "Executive summary" }),
  ).toBeVisible();
  await expect(report.locator(".report-document img")).toHaveCount(1);
  await expect(
    report.getByRole("button", { name: "Export PDF", exact: true }),
  ).toBeEnabled();
  await checkAccessibility(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("nav.sidebar")).toBeHidden();
  const pdf = await page.pdf({
    path: info.outputPath("report.pdf"),
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(pdf.length).toBeGreaterThan(20000);
  await page.screenshot({
    path: info.outputPath("report-print.png"),
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  await expect(report).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Compare: Clean-filter baseline",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Load stale POC demo", exact: true })
    .click();
  await expect(score).toContainText("3.0 h old");
  await expect(score).toContainText("Unreliable");
  await expect(score).toContainText("POC health index A: —");
  await expect(
    page.getByLabel("Stale held value (not a fresh measurement)", {
      exact: true,
    }),
  ).toBeChecked();
  await page.screenshot({ path: info.outputPath("stale.png"), fullPage: true });
  await page
    .getByRole("button", { name: "Load missing POC demo", exact: true })
    .click();
  await expect(score).toContainText("Missing");
  expect(errors).toEqual([]);
});
test("Pass 3 scenario applies only on run, resets and reports uncertainty", async ({
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
  await page.getByRole("button", { name: "Build Report", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview report", exact: true })
    .click();
  await expect(page.locator(".report-document")).toContainText(
    "No intervention effect has been validated",
  );
});
test("local saves work after network loss and versions are inspectable", async ({
  page,
  context,
}) => {
  await page.goto("/equipment/air-blower");
  await page.getByText("POC demo data", { exact: true }).click();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Load current POC demo", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Asset health scorecard", exact: true }),
  ).toContainText("82 / 100");
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
