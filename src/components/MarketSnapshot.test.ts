import { describe, expect, it } from "vitest";
import snapshot from "../../public/data/crude-market-prices.json";
import { parseLiveMarket } from "../lib/liveMarket";

describe("published market snapshot", () => {
  it("accepts a complete dated snapshot with all source metadata", () => {
    const parsed = parseLiveMarket(snapshot);
    expect(Object.keys(parsed.crude)).toHaveLength(5);
    expect(Object.keys(parsed.product)).toHaveLength(7);
    expect(parsed.provenance.product.detail.lpg.ui_label).toContain("Alberta");
  });
  it.each([null, -1, 0, NaN, Infinity])(
    "rejects invalid or unavailable prices (%s)",
    (value) => {
      const invalid = structuredClone(snapshot);
      Object.assign(invalid.product, { diesel: value });
      expect(() => parseLiveMarket(invalid)).toThrow();
    },
  );
  it("rejects incomplete prices and invalid publication timestamps", () => {
    expect(() =>
      parseLiveMarket({ ...snapshot, crude: { OSH: 100 } }),
    ).toThrow();
    expect(() =>
      parseLiveMarket({ ...snapshot, generatedAt: "not a date" }),
    ).toThrow();
  });
});
