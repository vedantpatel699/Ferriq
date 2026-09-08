# Ferriq

Current remediation: see [REMEDIATION.md](REMEDIATION.md), [QUALITY.md](QUALITY.md), and [DATABASE.md](DATABASE.md). Data storage is static GitHub Pages JSON plus browser-local IndexedDB. No external backend is required.

Industrial engineering surveillance for process equipment — proactive
monitoring (detecting change and degradation) rather than an operator-style
alarm screen. Built with Vite, React, and TypeScript.

## Architecture

Engineering/domain logic is kept separate from presentation and is
independently testable:

```
src/
  engineering/        pure, framework-free calculation modules
    blower/           Air Blower — ASME PTC 10 polytropic/isentropic efficiency,
                       ISO 10816-3 vibration tiering
    heater/           Fired Heater — 17-component fuel-gas combustion model,
                       direct/PTC4-indirect efficiency
    exchanger/        Shell & Tube Exchanger — TEMA LMTD correction factor,
                       fouling resistance
    membrane/         Membrane Analyzer — online/lab H2 recovery
    furnace/          Furnace Skin TI Predictor — XGBoost quantile-tree
                       forecasting, walks the trained model in public/data/
    crudeToProfit/    Crude to Profit — full refinery yield/economics model
    types.ts          shared engineering types (EquipmentState, MetricValue,
                       Condition, TimeRange, ...)
  components/         shared UI: AppShell, Sidebar, MetricCard, StatusBadge,
                       FerriqTrendChart (ECharts), TrendRangeSelector,
                       CalculationBasisDialog, DataQualityNotice, ...
  lib/                equipmentRegistry, timeRange (Shift/24H/7D/Custom),
                       settingsStore (persisted settings)
  pages/              one file per route (React Router)
```

Every equipment module was ported from the real production engine (not
from any design-spec documentation, which had drifted from what actually
ships) and is covered by golden-value/consistency tests before any UI
consumes it.

Ferriq's own page-level engineering-state vocabulary — **NORMAL / WATCH /
INVESTIGATE / DATA ISSUE** — is distinct from the raw physical severity
tiers (advisory/alarm/trip) that come from underlying standards like ISO
10816 or API 530. The raw tiers appear as reference facts (health-bar
zone labels, chart threshold lines); they are never the page-level status
pill. See the comment block in `engineering/types.ts` for the full
convention.

## Development

```
npm install
npm run dev          # dev server
npm run build         # tsc -b && vite build
npm test               # vitest — engineering-module unit tests
npm run test:e2e        # playwright — navigation, interactions, a11y (axe-core)
```

## Fonts

Barlow / Barlow Condensed are self-hosted via `@fontsource` rather than
fetched from Google Fonts — Ferriq is a plant/industrial tool that may run
on a restricted or air-gapped network.
