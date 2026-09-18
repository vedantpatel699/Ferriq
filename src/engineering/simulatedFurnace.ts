import { DateTime } from "luxon";
import { demoTimeline, DEMO_AS_OF } from "./simulation";
import type { FurnaceModelBundle } from "./furnace/calculations";

/** Replay complete operating windows jointly, retaining sensor/flow relationships.
 * Source dates are never relabelled as measurements. Synthetic dates use a fixed
 * sequence of 14-day source blocks, with four-hour interpolation between samples.
 */
export function simulatedFurnace(
  original: FurnaceModelBundle,
): FurnaceModelBundle {
  const bundle = structuredClone(original);
  bundle.demo_source =
    "Simulated 2026 YTD history based on recorded operating patterns; original dated records are available in Data & Log";
  bundle.demo_as_of = DEMO_AS_OF;
  for (const furnace of Object.values(bundle.furnaces)) {
    const aliases = Object.keys(furnace.tc_models);
    furnace.reference_history = structuredClone(furnace.history);
    const valid = furnace.history.filter(
      (row) =>
        aliases.every(
          (a) =>
            typeof row[a] === "number" &&
            Number(row[a]) >= 150 &&
            Number(row[a]) <= 700,
        ) &&
        Array.from({ length: furnace.passes }, (_, i) =>
          Number(row[`flow_p${i + 1}`]),
        ).every((v) => v > 0),
    );
    if (valid.length < 2)
      throw new Error(
        `Insufficient recorded operating data for ${furnace.label}`,
      );
    const sourceCadence = furnace.cadence_hours;
    furnace.cadence_hours = 4;
    furnace.history = demoTimeline(4).map((t, index) => {
      const block = Math.floor(index / 84);
      const position =
        ((block * 97 + 31) % Math.max(1, valid.length - 85)) +
        ((index % 84) * 4) / sourceCadence;
      const left = Math.floor(position) % (valid.length - 1),
        weight = position % 1;
      const a = valid[left],
        b = valid[left + 1];
      const row: Record<string, number | string | null> = {
        t: DateTime.fromMillis(t, { zone: "America/Edmonton" }).toISO()!,
        data_source: "Simulated from recorded operating patterns",
      };
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (key === "t") continue;
        row[key] =
          typeof a[key] === "number" && typeof b[key] === "number"
            ? Number(a[key]) + weight * (Number(b[key]) - Number(a[key]))
            : null;
      }
      for (let pass = 1; pass <= furnace.passes; pass++)
        row[`skin_max_p${pass}`] = Math.max(
          ...aliases
            .filter((a) => furnace.tc_models[a].pass === pass)
            .map((a) => Number(row[a])),
        );
      return row;
    });
  }
  return bundle;
}
