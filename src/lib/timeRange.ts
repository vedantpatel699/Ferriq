// Shared Shift / 24H / 7D / Custom time-range engine. Selecting a range
// must change the actual queried window (and therefore chart data and
// period deltas) — never just recolor a pill. Fixed engineering values
// (design values, commissioning baselines, SIS references, condition
// start timestamps) are never redefined by the selected range; only the
// "change over this window" comparison uses it.

import { DateTime } from "luxon";
import type { TimeRangeId, TimeRange } from "../engineering/types";
import { getFerriqSettings, type FerriqSettings } from "./settingsStore";

/** Site/plant timezone. Ferriq's engineering defaults (atmospheric
 *  pressure, etc.) reference an Alberta installation; site time follows
 *  that plant's local zone rather than the viewer's browser timezone. */
export const SITE_TIMEZONE = "America/Edmonton";

export function nowInSiteZone(): DateTime {
  return DateTime.now().setZone(SITE_TIMEZONE);
}

/** "Shift" means the shift containing `now`, using the configured shift
 *  boundaries (Settings page) — not simply "the last N hours". Reads live
 *  from the persisted settings store, so a Settings change takes effect
 *  everywhere immediately. */
export function currentShiftWindow(
  now: DateTime,
  settings: FerriqSettings = getFerriqSettings(),
): { start: DateTime; end: DateTime; label: string } {
  const { shiftStartHour, shiftEndHour } = settings;
  const siteNow = now.setZone(SITE_TIMEZONE);
  const todayDayStart = siteNow.set({
    hour: shiftStartHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const todayDayEnd = siteNow.set({
    hour: shiftEndHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  if (siteNow >= todayDayStart && siteNow < todayDayEnd) {
    return { start: todayDayStart, end: todayDayEnd, label: "Day" };
  }
  // Night shift: 19:00 today -> 07:00 tomorrow, or 19:00 yesterday -> 07:00 today
  if (siteNow >= todayDayEnd) {
    return {
      start: todayDayEnd,
      end: todayDayStart.plus({ days: 1 }),
      label: "Night",
    };
  }
  return {
    start: todayDayEnd.minus({ days: 1 }),
    end: todayDayStart,
    label: "Night",
  };
}

export interface CustomRangeInput {
  start: Date;
  end: Date;
}

export function resolveTimeRange(
  id: TimeRangeId,
  now: DateTime,
  custom?: CustomRangeInput,
  settings: FerriqSettings = getFerriqSettings(),
): TimeRange {
  const siteNow = now.setZone(SITE_TIMEZONE);
  if (id === "shift") {
    const { start, end } = currentShiftWindow(siteNow, settings);
    return { id, start: start.toJSDate(), end: end.toJSDate() };
  }
  if (id !== "custom") {
    const match = id.match(/^(\d+)([hd])$/)!;
    return {
      id,
      start: siteNow
        .minus(
          match[2] === "h"
            ? { hours: Number(match[1]) }
            : { days: Number(match[1]) },
        )
        .toJSDate(),
      end: siteNow.toJSDate(),
    };
  }
  // custom
  if (custom) return { id, start: custom.start, end: custom.end };
  return {
    id,
    start: siteNow.minus({ days: 7 }).toJSDate(),
    end: siteNow.toJSDate(),
  };
}

export function rangeContextLabel(range: TimeRange): string {
  const start = DateTime.fromJSDate(range.start).setZone(SITE_TIMEZONE);
  const end = DateTime.fromJSDate(range.end).setZone(SITE_TIMEZONE);
  if (range.id === "shift") {
    return `${start.hasSame(end, "day") ? "Day" : "Night"} shift ${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`;
  }
  if (range.id === "custom") {
    return `${start.toFormat("LLL d, HH:mm")} – ${end.toFormat("LLL d, HH:mm")}`;
  }
  return `${TIME_RANGE_LABELS[range.id]} · ${start.toFormat("LLL d, yyyy HH:mm")} to ${end.toFormat("LLL d, yyyy HH:mm")} Edmonton`;
}

export const TIME_RANGE_LABELS: Record<TimeRangeId, string> = {
  shift: "Shift",
  "1h": "1H",
  "24h": "24H",
  "30d": "30D",
  "90d": "90D",
  "7d": "7D",
  custom: "Custom",
};
