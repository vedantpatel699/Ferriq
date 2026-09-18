import { DateTime } from "luxon";
import {
  calcHeaterRow,
  DEFAULT_HEATER_CONFIG,
  type HeaterRowInput,
} from "./heater/calculations";
import {
  calcExchangerRow,
  DEFAULT_EXCHANGER_CONFIG,
} from "./exchanger/calculations";

// Fixed, reproducible review clock. No wall-clock/random dependence.
export const DEMO_AS_OF = "2026-09-17T17:00:00-06:00";
export const DEMO_SOURCE =
  "Simulated YTD · hourly · Jan 1–Sep 17, 2026 · not plant measurements";
export const DEMO_START = DateTime.fromISO(DEMO_AS_OF)
  .setZone("America/Edmonton")
  .startOf("year")
  .toMillis();
export const DEMO_END = DateTime.fromISO(DEMO_AS_OF).toMillis();
export function demoTimeline(stepHours = 1) {
  const times: number[] = [];
  for (let t = DEMO_START; t <= DEMO_END; t += stepHours * 3600000)
    times.push(t);
  if (times.at(-1)! < DEMO_END) times.push(DEMO_END);
  return times;
}
export function demoOperation(t: number) {
  const day = (t - DEMO_START) / 86400000;
  // Recurring load changes, gradual fouling, cleaning at days 100 and 200.
  const age = day % 100;
  return {
    day,
    age,
    load: 0.94 + 0.04 * Math.sin((day * 2 * Math.PI) / 7),
    wear: Math.max(0, age - 15) / 85,
  };
}
const cache = new Map<string, Record<string, unknown>[]>();
export function simulatedEquipment(id: string): Record<string, unknown>[] {
  if (cache.has(id)) return structuredClone(cache.get(id)!);
  const rows = demoTimeline().map((t) => {
    const { day, load, wear } = demoOperation(t);
    const timestamp = DateTime.fromMillis(t, {
      zone: "America/Edmonton",
    }).toISO()!;
    const ambient =
      4 +
      12 * Math.sin(((day - 90) * 2 * Math.PI) / 365) +
      2 * Math.sin(day * 2 * Math.PI);
    if (id === "air-blower") {
      const current = 114 + 5 * Math.sin((day * 2 * Math.PI) / 7);
      const p1 = 93 + Math.sin((day * 2 * Math.PI) / 5),
        p2 = 85 + Math.sin((day * 2 * Math.PI) / 3);
      const eta = 0.76 - 0.025 * wear;
      const discharge =
        (ambient + 273.15) * Math.pow((p2 + 93) / p1, 0.4 / 1.4 / eta) - 273.15;
      return {
        timestamp,
        motorCurrentA: current,
        motorCurrentB: 0,
        suctionPressureA: p1,
        suctionPressureB: 93,
        dischargePressureA: p2,
        dischargePressureB: 0,
        controllerSpA: 85,
        controllerSpB: 85,
        bypassOpA: 0,
        bypassOpB: 70,
        filterDpA: 0.001 + 0.007 * wear,
        filterDpB: 0,
        totalFlowNm3hr: (180 * current - 500) * (1 - 0.05 * wear),
        suctionTempC: ambient,
        dischargeTempA: discharge,
        dischargeTempB: ambient,
        vibrationA: [1.3, 1.4, 1.2, 1.5].map((v) => v + wear * 0.8),
        vibrationB: [0, 0, 0, 0],
        bearingTempA: [55 + 12 * wear + load, 59 + 12 * wear + load],
        bearingTempB: [ambient, ambient],
      };
    }
    if (id === "fired-heater") {
      const row: HeaterRowInput = {
        timestamp,
        fuelFlowKgS: 0.849 * load,
        combustionAirTempC: ambient,
        stackTempC: 294 + 20 * wear,
        fuelTempC: 30,
        processFlowKgS: 142 * load,
        processInC: 256,
        processOutC: 340,
        processCpKjKgK: 2.978,
        stackO2Pct: 4.27 + 0.2 * wear,
        bridgewallAC: 778 + 15 * wear,
        bridgewallBC: 780 + 15 * wear,
      };
      const q = calcHeaterRow(row, DEFAULT_HEATER_CONFIG).qAbsorbedKw!;
      row.processOutC =
        row.processInC! + q / (row.processFlowKgS! * row.processCpKjKgK!);
      return { ...row };
    }
    if (id === "shell-tube-exchanger") {
      // Solve equal hot/cold duty for U=A-independent fouling resistance.
      const row = {
        timestamp,
        hotInC: 274,
        coldInC: 123,
        hotOutC: 200,
        coldOutC: 180,
        hotFlowKgHr: 50000 * load,
        hotCpKjKgK: 2.4646,
        coldFlowKgHr: 76128 * load,
        coldCpKjKgK: 1.9741,
        shellDpBar: 0.18 + 0.04 * wear,
        tubeDpBar: 0.22 + 0.05 * wear,
      };
      const targetU =
        1 / (1 / DEFAULT_EXCHANGER_CONFIG.uCleanWm2k + wear * 0.0005);
      let lo = 0,
        hi = 7000;
      for (let i = 0; i < 50; i++) {
        const q = (lo + hi) / 2;
        row.hotOutC =
          row.hotInC - (q * 3600) / (row.hotFlowKgHr * row.hotCpKjKgK);
        row.coldOutC =
          row.coldInC + (q * 3600) / (row.coldFlowKgHr * row.coldCpKjKgK);
        const r = calcExchangerRow(row, DEFAULT_EXCHANGER_CONFIG);
        if (r.uDirtyWm2k === null || r.uDirtyWm2k > targetU) hi = q;
        else lo = q;
      }
      return row;
    }
    const feed = 95000 * load,
      composition = 89 + 0.6 * Math.sin(day / 9),
      purity = 98 - 0.3 * wear;
    const recovery = 0.9 - 0.035 * wear,
      permeate = (((feed * composition) / 100) * recovery) / (purity / 100);
    return {
      timestamp,
      feedFlowNm3Hr: feed,
      permeateFlowNm3Hr: permeate,
      nonPermeateFlowNm3Hr: feed - permeate,
      feedH2OnlinePct: composition,
      feedH2LabPct: composition,
      permeateH2OnlinePct: purity,
      permeateH2LabPct: purity,
      feedPressureKpag: 15900 + 100 * (load - 0.94),
    };
  });
  cache.set(id, rows);
  return structuredClone(rows);
}
