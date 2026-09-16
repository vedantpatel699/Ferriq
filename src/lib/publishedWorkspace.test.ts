import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateResources } from "./publishedWorkspace";
import { validateResource } from "../shared/workspace";

it("accepts published resources and the complete published predictor model", () => {
  const base = JSON.parse(readFileSync("public/data/workspace.json", "utf8"));
  expect(validateResources(base.resources)).toHaveLength(6);
  const model = JSON.parse(
    readFileSync("public/data/furnace-skin-temp-model.json", "utf8"),
  );
  expect(validateResource("furnace-model", model)).toEqual(model);
});
it("rejects duplicate, unknown and malformed persisted resources", () => {
  const settings = {
    key: "settings",
    version: 2,
    updatedAt: "today",
    data: { shiftStartHour: 6, shiftEndHour: 19 },
  };
  expect(() => validateResources([settings, settings])).toThrow("Duplicate");
  expect(() => validateResources([{ ...settings, key: "unknown" }])).toThrow();
  expect(() => validateResources([{ ...settings, version: NaN }])).toThrow();
  expect(() =>
    validateResources([
      { ...settings, data: { shiftStartHour: 20, shiftEndHour: 6 } },
    ]),
  ).toThrow();
});
