import { test, expect } from "@playwright/test";

test("overview defers chart code and a failed page download leaves navigation usable", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("#main-content h1")).toHaveText(
    "Engineering overview",
  );
  expect(
    requests.some((url) => /FerriqTrendChart-|EquipmentWorkspace-/.test(url)),
  ).toBe(false);
  await page.route("**/assets/FurnaceSkinTempPage-*.js", (route) =>
    route.abort(),
  );
  await page
    .getByRole("link", { name: /Furnace Skin TI Predictor/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "This page could not be displayed" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
});

test("malformed stored settings are retained but not applied", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.locator("input").first()).toHaveValue("7");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("ferriq-workspace", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("resources", "readwrite");
          tx.objectStore("resources").put({
            key: "settings",
            version: 2,
            updatedAt: "today",
            data: { shiftStartHour: 99, shiftEndHour: 19 },
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      }),
  );
  await page.reload();
  await expect(page.getByText(/Read-only mode: browser storage/)).toBeVisible();
  await expect(page.locator("input").first()).toHaveValue("7");
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true }),
  ).toBeDisabled();
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("ferriq-workspace", 1);
        request.onsuccess = () => {
          const db = request.result,
            value = db
              .transaction("resources")
              .objectStore("resources")
              .get("settings");
          value.onsuccess = () => {
            db.close();
            resolve(value.result.data.shiftStartHour);
          };
          value.onerror = () => {
            db.close();
            reject(value.error);
          };
        };
      }),
  );
  expect(stored).toBe(99);
});

test("a stalled model does not block economics; a failed model can be retried", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/data/furnace-skin-temp-model.json", async (route) => {
    await held;
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto("/crude-to-profit", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Annual estimate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Loading the published predictor model. Other dashboards are available.",
      { exact: true },
    ),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("button", { name: "Retry predictor model" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Furnace Skin TI Predictor/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Furnace Skin TI Predictor",
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/data/furnace-skin-temp-model.json");
  await page.getByRole("button", { name: "Retry predictor model" }).click();
  await expect(
    page.getByRole("combobox", { name: "Furnace", exact: true }),
  ).toBeVisible();
});

test("unavailable storage keeps published data readable and can recover", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      if (
        !(window as unknown as { storageRecovered: boolean }).storageRecovered
      )
        throw Error("Blocked storage");
      return open.apply(this, args);
    };
  });
  await page.goto("/settings");
  await expect(page.getByText(/Read-only mode: browser storage/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reset to Defaults" }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "Crude to Profit", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save scenario", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Restore published scenario" }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "Database & change log", exact: true })
    .click();
  await expect(
    page.getByLabel("Import workspace backup", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export workspace backup" }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  // Finish the independent model refresh before specifically testing manual storage recovery.
  await expect(
    page.getByText(
      "Loading the published predictor model. Other dashboards are available.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { storageRecovered: boolean }).storageRecovered =
      true;
  });
  await page.getByRole("button", { name: "Retry browser storage" }).click();
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true }),
  ).toBeEnabled();
  await page.locator("input").first().fill("6");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
});

test("storage failure after a save preserves the loaded local data", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.locator("input").first().fill("6");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.evaluate(() => {
    IDBFactory.prototype.open = function () {
      throw Error("Storage went away");
    };
    const channel = new BroadcastChannel("ferriq-workspace");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByText(/Read-only mode: browser storage/)).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.locator("input").first()).toHaveValue("6");
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true }),
  ).toBeDisabled();
});

test("malformed published data produces recovery controls instead of a blank page", async ({
  page,
}) => {
  await page.route("**/data/workspace.json", (route) =>
    route.fulfill({ json: { revision: "bad", resources: [] } }),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("missing settings");
  await page.unroute("**/data/workspace.json");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("#main-content h1")).toBeVisible();
});
