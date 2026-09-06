// Small illustrative sample series for the Fired Heater dashboard. Not
// historian data — seeded to exercise the real calcHeaterRow/buildAlerts
// pipeline (engineering/heater/calculations.ts) with plausible values
// around the page's design point (see DEFAULT_HEATER_CONFIG).
import type { HeaterRowInput } from "./calculations";

export const HEATER_DEMO_DATA: HeaterRowInput[] = [
  { timestamp: "2026-02-01 00:00:00", fuelFlowKgS: 0.849, combustionAirTempC: 12, stackTempC: 294, fuelTempC: 22, processFlowKgS: 25, processInC: 80, processOutC: 140, processCpKjKgK: 2.8, stackO2Pct: 4.27, bridgewallAC: 780, bridgewallBC: 776 },
  { timestamp: "2026-02-01 06:00:00", fuelFlowKgS: 0.851, combustionAirTempC: 13, stackTempC: 297, fuelTempC: 22, processFlowKgS: 25, processInC: 80, processOutC: 139, processCpKjKgK: 2.8, stackO2Pct: 4.30, bridgewallAC: 782, bridgewallBC: 778 },
  { timestamp: "2026-02-01 12:00:00", fuelFlowKgS: 0.855, combustionAirTempC: 16, stackTempC: 301, fuelTempC: 24, processFlowKgS: 25, processInC: 81, processOutC: 140, processCpKjKgK: 2.8, stackO2Pct: 4.40, bridgewallAC: 786, bridgewallBC: 781 },
  { timestamp: "2026-02-01 18:00:00", fuelFlowKgS: 0.858, combustionAirTempC: 14, stackTempC: 306, fuelTempC: 23, processFlowKgS: 25, processInC: 80, processOutC: 138, processCpKjKgK: 2.8, stackO2Pct: 4.55, bridgewallAC: 790, bridgewallBC: 785 },
  { timestamp: "2026-02-02 00:00:00", fuelFlowKgS: 0.862, combustionAirTempC: 11, stackTempC: 312, fuelTempC: 22, processFlowKgS: 25, processInC: 80, processOutC: 137, processCpKjKgK: 2.8, stackO2Pct: 4.70, bridgewallAC: 795, bridgewallBC: 790 },
  { timestamp: "2026-02-02 06:00:00", fuelFlowKgS: 0.866, combustionAirTempC: 12, stackTempC: 318, fuelTempC: 22, processFlowKgS: 25, processInC: 80, processOutC: 136, processCpKjKgK: 2.8, stackO2Pct: 4.85, bridgewallAC: 799, bridgewallBC: 794 },
  { timestamp: "2026-02-02 12:00:00", fuelFlowKgS: 0.870, combustionAirTempC: 15, stackTempC: 322, fuelTempC: 24, processFlowKgS: 25, processInC: 81, processOutC: 135, processCpKjKgK: 2.8, stackO2Pct: 4.95, bridgewallAC: 803, bridgewallBC: 798 },
];
