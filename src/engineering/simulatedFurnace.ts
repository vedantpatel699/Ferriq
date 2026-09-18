import { DateTime } from "luxon";
import { demoTimeline, demoOperation, DEMO_AS_OF } from "./simulation";
import type { FurnaceModelBundle } from "./furnace/calculations";
export function simulatedFurnace(
  original: FurnaceModelBundle,
): FurnaceModelBundle {
  const bundle = structuredClone(original);
  bundle.demo_source =
    "Simulated YTD operating history; trained models and holdout dates retained";
  bundle.demo_as_of = DEMO_AS_OF;
  for (const furnace of Object.values(bundle.furnaces)) {
    furnace.cadence_hours = 4;
    furnace.history = demoTimeline(4).map((t) => {
      const { day, load, age } = demoOperation(t);
      const row: Record<string, number | string | null> = {
        t: DateTime.fromMillis(t, { zone: "America/Edmonton" }).toISO()!,
        box_t_c: 650 + 10 * load,
        outlet_avg_t_c: 355 + 3 * load,
      };
      for (let pass = 1; pass <= furnace.passes; pass++) {
        row[`flow_p${pass}`] =
          120 * load * (1 + 0.02 * Math.sin(day / 11 + pass));
        const aliases = Object.entries(furnace.tc_models)
          .filter(([, m]) => m.pass === pass)
          .map(([a]) => a);
        const hottest = (pass === 3 ? 449 : 414 + pass * 3) + age * 0.27;
        aliases.forEach((a, i) => {
          row[a] = hottest - i * 3 + 0.25 * Math.sin(day / 4 + i);
        });
        row[`skin_max_p${pass}`] = Math.max(
          ...aliases.map((a) => Number(row[a])),
        );
      }
      return row;
    });
  }
  return bundle;
}
