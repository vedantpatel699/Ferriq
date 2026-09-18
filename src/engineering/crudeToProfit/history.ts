import { demoTimeline, demoOperation } from "../simulation";
import {
  CRUDES,
  PRODUCTS,
  type CrudeToProfitConfig,
  type CrudeCode,
  type ResidueUnit,
  type GasOilUnit,
} from "./data";
import { runModel } from "./calculations";
export function simulatedEconomics(
  flows: Record<CrudeCode, number>,
  config: CrudeToProfitConfig,
  residue: ResidueUnit,
  gas: GasOilUnit,
) {
  const times = demoTimeline(24);
  return times.slice(0, -1).map((t, i) => {
    const { day, load } = demoOperation(t);
    const factor = 0.5 + 0.2 * Math.sin(day / 31);
    const crude = Object.fromEntries(
      CRUDES.map((c) => [
        c,
        config.crude_price_low_cad_m3[c] * (1 - factor) +
          config.crude_price_high_cad_m3[c] * factor,
      ]),
    );
    const prices = Object.fromEntries(
      PRODUCTS.map((p) => [
        p,
        config.product_price_low_cad_m3[p] * (1 - factor) +
          config.product_price_high_cad_m3[p] * factor,
      ]),
    );
    const varied = Object.fromEntries(CRUDES.map((c) => [c, flows[c] * load]));
    const result = runModel(varied, config, crude, prices, residue, gas);
    const e = result.economics;
    return {
      start: t,
      end: times[i + 1],
      revenuePerHour: e.revenue_market_cad_hr!,
      feedCostPerHour: e.crude_cost_market_cad_hr!,
      opexPerHour: e.operating_costs_market!.cadPerOperatingHour,
      throughputM3Hr: Object.values(varied).reduce((a, b) => a + b, 0),
    };
  });
}
export function economicsWindow(
  rows: ReturnType<typeof simulatedEconomics>,
  start: number,
  end: number,
) {
  // Same 330/365 availability assumption as the annual scenario, spread over calendar intervals.
  return rows.flatMap((r) => {
    const from = Math.max(start, r.start),
      to = Math.min(end, r.end);
    if (to <= from) return [];
    const hours = (((to - from) / 3600000) * 330) / 365;
    const revenue = r.revenuePerHour * hours,
      feedCost = r.feedCostPerHour * hours,
      opex = r.opexPerHour * hours;
    return [
      {
        timestamp: new Date(from).toISOString(),
        end: new Date(to).toISOString(),
        operatingHours: hours,
        throughputM3: r.throughputM3Hr * hours,
        revenueCad: revenue,
        feedCostCad: feedCost,
        opexCad: opex,
        marginCad: revenue - feedCost - opex,
      },
    ];
  });
}
