import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { DEMO_AS_OF } from "../engineering/simulation";
import {
  simulatedEconomics,
  economicsWindow,
} from "../engineering/crudeToProfit/history";
import type {
  CrudeCode,
  CrudeToProfitConfig,
  ResidueUnit,
  GasOilUnit,
} from "../engineering/crudeToProfit/data";
import type { TimeRangeId } from "../engineering/types";
import { resolveTimeRange, rangeContextLabel } from "../lib/timeRange";
import { TrendRangeSelector } from "./TrendRangeSelector";
import { DataTable } from "./DataTable";
export function EconomicsHistory({
  flows,
  config,
  residue,
  gas,
}: {
  flows: Record<CrudeCode, number>;
  config: CrudeToProfitConfig;
  residue: ResidueUnit;
  gas: GasOilUnit;
}) {
  const [range, setRange] = useState<TimeRangeId>("ytd");
  const history = useMemo(
    () => simulatedEconomics(flows, config, residue, gas),
    [flows, config, residue, gas],
  );
  const period = resolveTimeRange(range, DateTime.fromISO(DEMO_AS_OF));
  const rows = economicsWindow(history, +period.start, +period.end);
  const totals = rows.reduce(
    (s, r) => ({
      revenueCad: s.revenueCad + r.revenueCad,
      feedCostCad: s.feedCostCad + r.feedCostCad,
      opexCad: s.opexCad + r.opexCad,
      marginCad: s.marginCad + r.marginCad,
    }),
    { revenueCad: 0, feedCostCad: 0, opexCad: 0, marginCad: 0 },
  );
  return (
    <section aria-label="Simulated economics history">
      <h2>Simulated operating history</h2>
      <p>
        January 1 through September 17, 2026, Edmonton time. Daily price and
        throughput assumptions; not historical market observations. Uses the
        current routing and configuration. Operating hours use 330/365 calendar
        availability. These period totals are separate from the annual scenario
        above.
      </p>
      <TrendRangeSelector
        value={range}
        onChange={setRange}
        includeCustom={false}
        contextLabel={rangeContextLabel(period)}
      />
      <DataTable caption="Selected period totals (CAD)" rows={[totals]} />
      <details className="advanced-panel">
        <summary>Supporting financial intervals</summary>
        <DataTable caption="Simulated financial intervals" rows={rows} />
      </details>
    </section>
  );
}
