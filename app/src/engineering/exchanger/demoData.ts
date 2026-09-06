// Small illustrative sample series for the Shell & Tube Exchanger
// dashboard, seeded to exercise the real calcExchangerRow/buildAlerts
// pipeline with a gently worsening fouling trend.
import type { ExchangerRowInput } from "./calculations";

export const EXCHANGER_DEMO_DATA: ExchangerRowInput[] = [
  { timestamp: "2026-02-01 00:00:00", hotInC: 180.5, hotOutC: 128.0, hotFlowKgHr: 50000, hotCpKjKgK: 2.15, coldInC: 40.1, coldOutC: 122.0, coldFlowKgHr: 50100, coldCpKjKgK: 2.05, shellDpBar: 0.18, tubeDpBar: 0.22 },
  { timestamp: "2026-02-01 06:00:00", hotInC: 180.7, hotOutC: 128.6, hotFlowKgHr: 50050, hotCpKjKgK: 2.15, coldInC: 40.0, coldOutC: 121.6, coldFlowKgHr: 50000, coldCpKjKgK: 2.05, shellDpBar: 0.19, tubeDpBar: 0.22 },
  { timestamp: "2026-02-01 12:00:00", hotInC: 180.6, hotOutC: 129.4, hotFlowKgHr: 50020, hotCpKjKgK: 2.15, coldInC: 40.3, coldOutC: 121.1, coldFlowKgHr: 50080, coldCpKjKgK: 2.05, shellDpBar: 0.20, tubeDpBar: 0.23 },
  { timestamp: "2026-02-01 18:00:00", hotInC: 180.4, hotOutC: 130.1, hotFlowKgHr: 50010, hotCpKjKgK: 2.15, coldInC: 40.2, coldOutC: 120.5, coldFlowKgHr: 50040, coldCpKjKgK: 2.05, shellDpBar: 0.21, tubeDpBar: 0.24 },
  { timestamp: "2026-02-02 00:00:00", hotInC: 180.8, hotOutC: 130.9, hotFlowKgHr: 50060, hotCpKjKgK: 2.15, coldInC: 40.1, coldOutC: 119.9, coldFlowKgHr: 50020, coldCpKjKgK: 2.05, shellDpBar: 0.22, tubeDpBar: 0.25 },
  { timestamp: "2026-02-02 06:00:00", hotInC: 180.5, hotOutC: 131.6, hotFlowKgHr: 50030, hotCpKjKgK: 2.15, coldInC: 40.4, coldOutC: 119.3, coldFlowKgHr: 50060, coldCpKjKgK: 2.05, shellDpBar: 0.23, tubeDpBar: 0.26 },
  { timestamp: "2026-02-02 12:00:00", hotInC: 180.6, hotOutC: 132.3, hotFlowKgHr: 50000, hotCpKjKgK: 2.15, coldInC: 40.2, coldOutC: 118.7, coldFlowKgHr: 50010, coldCpKjKgK: 2.05, shellDpBar: 0.24, tubeDpBar: 0.27 },
];
