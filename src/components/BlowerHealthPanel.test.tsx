import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlowerHealthPanel } from "./BlowerHealthPanel";
import type { Reading } from "../engineering/catalog";

function reading(overrides: Partial<Reading> = {}): Reading {
  return {
    timestamp: "2025-06-15T03:59:59",
    epoch: Date.parse("2025-06-15T03:59:59Z"),
    state: "watch",
    alerts: [
      {
        severity: "advisory",
        message: "Measured flow is 6.2% below the baseline regression expectation.",
        source: "healthy-baseline linear regression",
      },
    ],
    quality: ["Suction temperature is not available."],
    values: {
      activeBlower: "A",
      maxBearingTempC: 42,
      maxVibrationMms: 1.2,
      performanceDegradationPct: 6.2,
    },
    ...overrides,
  };
}

describe("BlowerHealthPanel", () => {
  it("presents generic train and system-health language", () => {
    const html = renderToStaticMarkup(<BlowerHealthPanel latest={reading()} />);
    expect(html).toContain("System health");
    expect(html).toContain("Active: Train A");
    expect(html).toContain("WATCH");
    expect(html).toContain("6.2%");
    expect(html).not.toMatch(/C-\d|1645-|\.PV/);
  });

  it("keeps data quality separate from active engineering conditions", () => {
    const html = renderToStaticMarkup(
      <BlowerHealthPanel
        latest={reading({ state: "normal", alerts: [] })}
      />,
    );
    expect(html).toContain("No configured engineering condition is exceeded");
    expect(html).toContain("Data quality and unavailable measurements");
  });
});
