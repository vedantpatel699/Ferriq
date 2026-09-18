import { expect, it } from "vitest";
import { buildAlerts, DEFAULT_BLOWER_LIMITS } from "./calculations";

it("does not turn an unvalidated operating index into a thrust alarm", () => {
  const inputs = {
    maxVibrationMms: 1,
    maxBearingTempC: 50,
    filterDpBar: 0.01,
    blowerDpBar: 0.8,
    bypassOpPct: 0,
    dischargePressureKpag: 90,
    controllerSpKpag: 90,
    thrustProxyPct: 99,
  };
  expect(buildAlerts(inputs, DEFAULT_BLOWER_LIMITS)).toEqual([]);
  const alerts = buildAlerts(
    { ...inputs, maxVibrationMms: 12 },
    DEFAULT_BLOWER_LIMITS,
  );
  expect(alerts).toHaveLength(1);
  expect(alerts[0].severity).toBe("trip");
  expect(alerts[0].source).toBe("configured vibration threshold");
  expect(alerts[0].message).not.toMatch(/Zone|ISO/);
});
