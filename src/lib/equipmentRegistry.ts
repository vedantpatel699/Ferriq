import type { EquipmentState } from "../engineering/types";

// Model names and navigation paths.
export interface EquipmentRegistryEntry {
  id: string;
  name: string;
  path: string;
}

export const EQUIPMENT_REGISTRY: EquipmentRegistryEntry[] = [
  {
    id: "air-blower",
    name: "Air Blower",
    path: "/equipment/air-blower",
  },
  {
    id: "fired-heater",
    name: "Fired Heater",
    path: "/equipment/fired-heater",
  },
  {
    id: "shell-tube-exchanger",
    name: "Shell & Tube Exchanger",
    path: "/equipment/shell-tube-exchanger",
  },
  {
    id: "membrane-analyzer",
    name: "Membrane Analyzer",
    path: "/equipment/membrane-analyzer",
  },
  {
    id: "furnace-skin-temp",
    name: "Furnace Skin TI Predictor",
    path: "/predictors/furnace-skin-temp",
  },
  { id: "crude-to-profit", name: "Crude to Profit", path: "/crude-to-profit" },
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
