import { test, expect } from "@playwright/test";
for (const id of ["air-blower", "shell-tube-exchanger"]) {
  test(`${id} old saved dataset can load current YTD without losing configuration`, async ({
    page,
  }) => {
    await page.goto("/equipment/" + id);
    await expect(
      page.getByRole("button", { name: "Engineering manual", exact: true }),
    ).toBeVisible();
    await page.evaluate(async (id) => {
      const published = await (await fetch("/data/workspace.json")).json();
      const resource = published.resources.find(
        (r: { key: string }) => r.key === id,
      );
      resource.data.rows = resource.data.rows
        .slice(0, 24)
        .map((r: Record<string, unknown>, i: number) => ({
          ...r,
          timestamp: `2021-01-${String(i + 1).padStart(2, "0")}T00:00:00-07:00`,
        }));
      resource.data.source = "Original HTML reference dataset (not live)";
      if (id === "air-blower")
        resource.data.config.settings.motorVoltageV = 4100;
      else resource.data.config.areaM2 = 130;
      resource.version = 2;
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("ferriq-workspace", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("resources", "readwrite");
          tx.objectStore("resources").put(resource);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }, id);
    await page.reload();
    await page
      .getByRole("button", { name: "Load current YTD sample data" })
      .click();
    await page.getByRole("button", { name: "YTD", exact: true }).click();
    await expect(
      page.getByText(/Available in window: 6233 observations/),
    ).toBeVisible();
    await page.reload();
    const value = await page.evaluate(
      async (id) =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open("ferriq-workspace", 1);
          request.onsuccess = () => {
            const db = request.result;
            const read = db
              .transaction("resources")
              .objectStore("resources")
              .get(id);
            read.onsuccess = () => {
              resolve(
                id === "air-blower"
                  ? read.result.data.config.settings.motorVoltageV
                  : read.result.data.config.areaM2,
              );
              db.close();
            };
          };
        }),
      id,
    );
    expect(value).toBe(id === "air-blower" ? 4100 : 130);
  });
}
test("Crude to Profit uses financial tables without a graph", async ({
  page,
}) => {
  await page.goto("/crude-to-profit");
  await expect(
    page.getByRole("heading", { name: "Annual estimate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /Annual profit reconciliation/ }),
  ).toBeVisible();
});
