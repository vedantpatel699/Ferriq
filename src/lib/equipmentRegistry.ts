// Single source of truth for equipment identity, navigation paths, and
// current engineering state — consumed by Sidebar, Home, and Watchlist so
// they never fall out of sync with each other. Real state (not this
// static registry) will come from each equipment's own engineering module
// once live/demo data is wired in; this registry's `state`/`stateLabel`
// fields are placeholders until that wiring lands.

import type { EquipmentState } from "../engineering/types";

export interface EquipmentRegistryEntry {
  id: string;
  name: string;
  tag: string;
  path: string;
  state: EquipmentState;
}

export const EQUIPMENT_REGISTRY: EquipmentRegistryEntry[] = [
  {
    id: "air-blower",
    name: "Air Blower",
    tag: "C-101A/B",
    path: "/equipment/air-blower",
    state: "watch",
  },
  {
    id: "fired-heater",
    name: "Fired Heater",
    tag: "H-401",
    path: "/equipment/fired-heater",
    state: "normal",
  },
  {
    id: "shell-tube-exchanger",
    name: "Shell & Tube Exchanger",
    tag: "E-201",
    path: "/equipment/shell-tube-exchanger",
    state: "watch",
  },
  {
    id: "membrane-analyzer",
    name: "Membrane Analyzer",
    tag: "M-301",
    path: "/equipment/membrane-analyzer",
    state: "watch",
  },
  {
    id: "furnace-skin-temp",
    name: "Furnace Skin TI Predictor",
    tag: "Heater 2 / Pass 2",
    path: "/predictors/furnace-skin-temp",
    state: "normal",
  },
];

export function stateLabel(state: EquipmentState): string {
  switch (state) {
    case "normal":
      return "NORMAL";
    case "watch":
      return "WATCH";
    case "investigate":
      return "INVESTIGATE";
    case "data-issue":
      return "DATA ISSUE";
  }
}
