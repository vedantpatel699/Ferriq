// Small illustrative sample series for the Membrane Analyzer dashboard,
// seeded to exercise the real calcMembraneRow/buildAlerts pipeline.
import type { MembraneRowInput } from "./calculations";

export const MEMBRANE_DEMO_DATA: MembraneRowInput[] = [
  { timestamp: "2026-02-01 08:00:00", feedFlowNm3Hr: 96200, nonPermeateFlowNm3Hr: null, permeateFlowNm3Hr: 80700, permeateH2OnlinePct: 95.3, permeateH2LabPct: 95.1, feedH2LabPct: 87.1, feedH2OnlinePct: null, feedPressureKpag: 15880 },
  { timestamp: "2026-02-01 14:00:00", feedFlowNm3Hr: 96300, nonPermeateFlowNm3Hr: null, permeateFlowNm3Hr: 80500, permeateH2OnlinePct: 95.0, permeateH2LabPct: null, feedH2LabPct: 87.0, feedH2OnlinePct: null, feedPressureKpag: 15900 },
  { timestamp: "2026-02-01 20:00:00", feedFlowNm3Hr: 96150, nonPermeateFlowNm3Hr: null, permeateFlowNm3Hr: 80200, permeateH2OnlinePct: 94.6, permeateH2LabPct: null, feedH2LabPct: 87.2, feedH2OnlinePct: null, feedPressureKpag: 15870 },
  { timestamp: "2026-02-02 08:00:00", feedFlowNm3Hr: 96280, nonPermeateFlowNm3Hr: null, permeateFlowNm3Hr: 79800, permeateH2OnlinePct: 94.1, permeateH2LabPct: 94.0, feedH2LabPct: 87.0, feedH2OnlinePct: null, feedPressureKpag: 15920 },
  { timestamp: "2026-02-02 14:00:00", feedFlowNm3Hr: 96250, nonPermeateFlowNm3Hr: null, permeateFlowNm3Hr: 79300, permeateH2OnlinePct: 93.6, permeateH2LabPct: null, feedH2LabPct: 86.9, feedH2OnlinePct: null, feedPressureKpag: 15905 },
];
