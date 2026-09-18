import { expect, it } from "vitest";
import { firstDifference } from "./submission-compare";
it("accepts the observed cross-runtime/platform arithmetic differences", () => {
  expect(firstDifference(67.07131529415886, 67.07131529415892)).toBeNull();
  expect(firstDifference(87.28771180983392, 87.28771180983398)).toBeNull();
});
it.each([
  [{ value: 100 }, { value: 100.00001 }],
  [{ value: 0 }, { value: 0.00000001 }],
  [{ value: null }, { value: 0 }],
  [{ severity: "ok" }, { severity: "advisory" }],
  [{ display: "87.2877" }, { display: "87.2878" }],
  [[1, 2], [1]],
  [{ value: 1 }, { value: 1, extra: 0 }],
  [{ value: 1 }, { value: "1" }],
])("rejects meaningful numeric, display or structural drift: %j", (a, b) => {
  expect(firstDifference(a, b)).not.toBeNull();
});
