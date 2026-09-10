// Crude to Profit refinery yield/economics model — constants ported
// verbatim from the live crude-to-profit.html engine. This is a real,
// documented refinery model (primary distillation → residue conversion
// → SimDist split → gas-oil conversion → product slate → economics),
// validated against a reference workbook per the live code's own
// comments ("ties out to the sheet").

export const CRUDES = ["OSH", "SHD", "AWB", "SCO", "FRB"] as const;
export type CrudeCode = (typeof CRUDES)[number];

export const PRIMARY_CUTS = [
  "naphtha",
  "ago",
  "vgo",
  "vr",
  "lvgo",
  "mvgo",
  "hvgo",
] as const;
export type PrimaryCut = (typeof PRIMARY_CUTS)[number];

export const RHC_PRODUCTS = [
  "rhc_naphtha",
  "diesel",
  "rhc_lvgo",
  "rhc_mvgo",
  "rhc_hvgo",
  "unconverted_residue",
] as const;

export const PRODUCTS = [
  "lpg",
  "naphtha",
  "swing_naphtha",
  "kerosene",
  "diesel",
  "swing_diesel",
  "uco",
] as const;
export type ProductCode = (typeof PRODUCTS)[number];

export const SIMDIST_STREAMS = [
  "srvr",
  "diesel",
  "naphtha",
  "lvgo",
  "mvgo",
  "hvgo",
  "crvr",
] as const;

export type ResidueUnit = "lc_finer" | "delayed_coker";
export type GasOilUnit = "hydrocracker" | "fcc";

export const RESIDUE_UNIT_LABELS: Record<ResidueUnit, string> = {
  lc_finer: "LC Finer",
  delayed_coker: "Delayed coker",
};
export const GAS_OIL_UNIT_LABELS: Record<GasOilUnit, string> = {
  hydrocracker: "Hydrocracker / hydrotreater",
  fcc: "Fluid catalytic cracking",
};

export const M3_TO_BBL = 6.290123456790123; // workbook value, volume calcs
export const BBL_PER_M3_PRICE = 6.28981077; // exact definition, price conversion only
export const OPERATING_DAYS_PER_YEAR = 330;
export const HOURS_PER_DAY = 24;
export const RHC_FEED_DENSITY_KG_M3 = 996.8;
export const RHC_PRODUCT_DENSITY_KG_M3 = 862.0;
export const LPG_LIQUID_DENSITY_KG_M3 = 560.0;
export const FCC_FEED_DENSITY_KG_M3 = 900.0;

export const DEFAULT_CRUDE_FLOWS_M3HR: Record<CrudeCode, number> = {
  OSH: 100.0,
  SHD: 87.0,
  AWB: 150.0,
  SCO: 15.0,
  FRB: 249.66666666666666,
};

export const CRUDE_PROPERTIES: Record<
  CrudeCode,
  { density_kg_m3: number; sulfur_wtpct: number }
> = {
  OSH: { density_kg_m3: 935.7, sulfur_wtpct: 2.88 },
  SHD: { density_kg_m3: 919.1, sulfur_wtpct: 3.87 },
  AWB: { density_kg_m3: 925.6, sulfur_wtpct: 4.09 },
  SCO: { density_kg_m3: 867.3, sulfur_wtpct: 0.13 },
  FRB: { density_kg_m3: 922.4, sulfur_wtpct: 3.75 },
};

export const LC_FINER_YIELD_WTPCT: Record<string, number> = {
  rhc_naphtha: 14.13,
  diesel: 23.95,
  rhc_lvgo: 12.32,
  rhc_mvgo: 9.78,
  rhc_hvgo: 2.44,
  unconverted_residue: 25.39,
  lpg_fuel_gas: 11.99,
  coke: 0.0,
};

export const GAS_OIL_KEYS = [
  "diesel",
  "rhc_lvgo",
  "rhc_mvgo",
  "rhc_hvgo",
] as const;
const GAS_OIL_TOTAL = GAS_OIL_KEYS.reduce(
  (a, k) => a + LC_FINER_YIELD_WTPCT[k],
  0,
);
export const GAS_OIL_SPLIT: Record<string, number> = Object.fromEntries(
  GAS_OIL_KEYS.map((k) => [k, LC_FINER_YIELD_WTPCT[k] / GAS_OIL_TOTAL]),
);

export const FCC_YIELD_WTPCT = {
  dry_gas: 4.0,
  lpg: 12.0,
  gasoline: 47.0,
  lco: 21.0,
  slurry: 10.0,
  coke: 6.0,
};
export const FCC_PRODUCT_DENSITY_KG_M3: Record<string, number> = {
  lpg: 560.0,
  gasoline: 730.0,
  lco: 950.0,
  slurry: 1050.0,
};
export const FCC_PRODUCT_RANGE_C: Record<string, [number, number]> = {
  gasoline: [36, 220],
  lco: [220, 350],
  slurry: [350, 600],
};
export const PRODUCT_RANGE_C: Record<ProductCode, [number, number]> = {
  lpg: [0, 0], // LPG has no boiling-range slot; handled separately (vapour, not spread by range)
  naphtha: [36, 128],
  swing_naphtha: [128, 145],
  kerosene: [145, 277],
  diesel: [277, 340],
  swing_diesel: [340, 385],
  uco: [385, 600],
};

export interface FuelPricingMode {
  mode:
    | "regional_anchor"
    | "direct_market_benchmark"
    | "opportunity_value"
    | "opportunity_value_proxy";
  benchmark?: string;
  low?: string;
  high?: string;
  anchor?: string;
  factor?: number;
  label: string;
}

export interface CrudeToProfitConfig {
  primary_yield_volpct: Record<CrudeCode, Record<PrimaryCut, number>>;
  residue_unit: ResidueUnit;
  coker_feed_ccr_wtpct: number;
  lpg_fuel_gas_recovered: number;
  hcht_yield_volpct: Record<string, number>;
  simdist_split_volpct: Record<string, Record<ProductCode, number>>;
  crude_price_low_cad_m3: Record<CrudeCode, number>;
  crude_price_high_cad_m3: Record<CrudeCode, number>;
  product_price_low_cad_m3: Record<ProductCode, number>;
  product_price_high_cad_m3: Record<ProductCode, number>;
  crude_grade_differential_usd_bbl: Record<CrudeCode, number>;
  product_pricing: Record<ProductCode, FuelPricingMode>;
  swing_naphtha_to_kerosene: number;
  swing_diesel_to_diesel: number;
  lpg_c3_fraction: number;
  lpg_c4_fraction: number;
  gas_oil_unit: GasOilUnit;
}

export const DEFAULT_CRUDE_TO_PROFIT_CONFIG: CrudeToProfitConfig = {
  primary_yield_volpct: {
    OSH: {
      naphtha: 9.8,
      ago: 18.7,
      vgo: 63.4,
      vr: 8.3,
      lvgo: 11.0,
      mvgo: 30.9,
      hvgo: 21.5,
    },
    SHD: {
      naphtha: 25.8,
      ago: 12.0,
      vgo: 22.4,
      vr: 39.1,
      lvgo: 4.0,
      mvgo: 9.5,
      hvgo: 8.9,
    },
    AWB: {
      naphtha: 24.0,
      ago: 10.1,
      vgo: 22.9,
      vr: 42.0,
      lvgo: 3.6,
      mvgo: 9.5,
      hvgo: 9.8,
    },
    SCO: {
      naphtha: 16.2,
      ago: 35.11,
      vgo: 40.54,
      vr: 5.29,
      lvgo: 10.18,
      mvgo: 18.31,
      hvgo: 12.05,
    },
    FRB: {
      naphtha: 22.0,
      ago: 12.2,
      vgo: 25.1,
      vr: 40.4,
      lvgo: 4.1,
      mvgo: 10.6,
      hvgo: 10.4,
    },
  },
  residue_unit: "lc_finer",
  coker_feed_ccr_wtpct: 15.0,
  lpg_fuel_gas_recovered: 0.0, // Combined fuel gas is not verified saleable LPG.
  hcht_yield_volpct: {
    c3: 1.55,
    ic4: 2.96,
    nc4: 1.49,
    naphtha: 18.94,
    swing_naphtha: 5.41,
    kerosene: 43.85,
    diesel: 20.36,
    swing_diesel: 9.29,
    uco: 7.58,
  },
  simdist_split_volpct: {
    srvr: {
      lpg: 0,
      naphtha: 0,
      swing_naphtha: 0,
      kerosene: 0,
      diesel: 0,
      swing_diesel: 0,
      uco: 100,
    },
    diesel: {
      lpg: 0,
      naphtha: 0,
      swing_naphtha: 0,
      kerosene: 45,
      diesel: 40,
      swing_diesel: 14,
      uco: 1,
    },
    naphtha: {
      lpg: 0,
      naphtha: 37,
      swing_naphtha: 15,
      kerosene: 0,
      diesel: 48,
      swing_diesel: 0,
      uco: 0,
    },
    lvgo: {
      lpg: 0,
      naphtha: 0,
      swing_naphtha: 0,
      kerosene: 2,
      diesel: 23,
      swing_diesel: 30,
      uco: 45,
    },
    mvgo: {
      lpg: 0,
      naphtha: 0,
      swing_naphtha: 0,
      kerosene: 0,
      diesel: 3,
      swing_diesel: 15,
      uco: 82,
    },
    hvgo: {
      lpg: 0,
      naphtha: 0,
      swing_naphtha: 0,
      kerosene: 0,
      diesel: 0,
      swing_diesel: 0,
      uco: 100,
    },
    crvr: {
      lpg: 0,
      naphtha: 0,
      swing_naphtha: 0,
      kerosene: 0,
      diesel: 0,
      swing_diesel: 0,
      uco: 100,
    },
  },
  crude_price_low_cad_m3: { OSH: 580, SHD: 500, AWB: 500, SCO: 610, FRB: 500 },
  crude_price_high_cad_m3: { OSH: 640, SHD: 570, AWB: 580, SCO: 680, FRB: 570 },
  product_price_low_cad_m3: {
    lpg: 650,
    naphtha: 720,
    swing_naphtha: 760,
    kerosene: 1150,
    diesel: 1100,
    swing_diesel: 1000,
    uco: 520,
  },
  product_price_high_cad_m3: {
    lpg: 780,
    naphtha: 810,
    swing_naphtha: 850,
    kerosene: 1300,
    diesel: 1280,
    swing_diesel: 1150,
    uco: 650,
  },
  crude_grade_differential_usd_bbl: {
    OSH: 11.85,
    SHD: 11.45,
    AWB: 11.45,
    SCO: 8.85,
    FRB: 11.45,
  },
  product_pricing: {
    lpg: {
      mode: "regional_anchor",
      benchmark: "propane_usd_gal",
      label: "Alberta NGL price, moved daily",
    },
    naphtha: {
      mode: "regional_anchor",
      benchmark: "gasoline_usd_gal",
      label: "Alberta NGL price, moved daily",
    },
    kerosene: {
      mode: "direct_market_benchmark",
      benchmark: "jetfuel_usd_gal",
      label: "EIA jet-fuel benchmark",
    },
    diesel: {
      mode: "direct_market_benchmark",
      benchmark: "ulsd_gc_usd_gal",
      label: "EIA ULSD benchmark",
    },
    swing_naphtha: {
      mode: "opportunity_value",
      low: "naphtha",
      high: "kerosene",
      label: "Model-derived opportunity value",
    },
    swing_diesel: {
      mode: "opportunity_value",
      low: "uco",
      high: "diesel",
      label: "Model-derived opportunity value",
    },
    uco: {
      mode: "opportunity_value_proxy",
      anchor: "WCS",
      factor: 0.825,
      label: "Heavy-product opportunity-value proxy",
    },
  },
  swing_naphtha_to_kerosene: 0.5,
  swing_diesel_to_diesel: 0.5,
  lpg_c3_fraction: 0.258,
  lpg_c4_fraction: 0.742,
  gas_oil_unit: "hydrocracker",
};
