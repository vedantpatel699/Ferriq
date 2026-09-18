import { writeFileSync, readFileSync } from "node:fs";
import * as heater from "../src/engineering/heater/calculations";
import * as fuel from "../src/engineering/heater/fuelData";
import { DEFAULT_EXCHANGER_CONFIG } from "../src/engineering/exchanger/calculations";
import { DEFAULT_MEMBRANE_CONFIG } from "../src/engineering/membrane/calculations";
import {
  DEFAULT_BLOWER_SETTINGS,
  DEFAULT_BLOWER_LIMITS,
} from "../src/engineering/blower/calculations";
import { DEFAULT_CRUDE_TO_PROFIT_CONFIG } from "../src/engineering/crudeToProfit/data";
function save(path: string, text: string) {
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8").replaceAll("\r\n", "\n") !== text)
      throw Error("Submission data differs: " + path);
  } else writeFileSync(path, text);
}
const base = "submission/sudhakar/data/";
const defaults = {
  "air-blower": {
    settings: DEFAULT_BLOWER_SETTINGS,
    limits: DEFAULT_BLOWER_LIMITS,
  },
  "fired-heater": heater.DEFAULT_HEATER_CONFIG,
  "shell-tube-exchanger": DEFAULT_EXCHANGER_CONFIG,
  "membrane-analyzer": DEFAULT_MEMBRANE_CONFIG,
  "crude-to-profit": DEFAULT_CRUDE_TO_PROFIT_CONFIG,
  "furnace-skin-temp": { furnace: "heater_1", pass: 3, horizonDays: 7 },
};
save(base + "defaults.json", JSON.stringify(defaults, null, 2) + "\n");
save(base + "fuels.json", JSON.stringify(fuel, null, 2) + "\n");
const bundle = JSON.parse(
  readFileSync("public/data/furnace-skin-temp-model.json", "utf8"),
);
// All inputs are already public. No private workbook/email is copied.
save(base + "furnace-model.json", JSON.stringify(bundle) + "\n");
