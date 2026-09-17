import { describe, expect, it } from "vitest";
import snapshot from "../../public/data/crude-market-prices.json";
import { parseLiveMarket } from "../lib/liveMarket";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketSnapshot } from "./MarketSnapshot";

describe("published market snapshot", () => {
  it("converts offset publication times to UTC before labelling them UTC", () => {
    const market = parseLiveMarket({ ...snapshot, generatedAt: "2026-09-14T13:32:26-06:00" });
    const html = renderToStaticMarkup(createElement(MarketSnapshot, { market, status: "", loading: false, refresh: async () => {} }));
    expect(html).toContain("2026-09-14 19:32:26");
    expect(html).not.toContain("2026-09-14 13:32:26");
  });
  it("accepts a complete dated snapshot with display provenance", () => {
    const parsed = parseLiveMarket(snapshot);
    expect(Object.keys(parsed.crude)).toHaveLength(5);
    expect(Object.keys(parsed.product)).toHaveLength(7);
    const lpg = parsed.provenance.product.detail.lpg;
    expect(typeof lpg.ui_label).toBe("string");
    expect(lpg.ui_label.trim().length).toBeGreaterThan(0);
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
