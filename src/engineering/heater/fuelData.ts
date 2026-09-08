// Fired Heater fuel-gas composition data — ported verbatim from the live
// fired-heater.html engine. This multi-component combustion model
// (17 components, several named plant fuel-gas cases plus a custom-blend
// builder) is what the live dashboard actually runs; it supersedes the
// fixed natural-gas-only constants in backend-fired-heater.md.

export interface FuelComponentProps {
  mw: number;
  lhvMjKg: number;
  o2: number;
  h2o: number;
  co2: number;
}

export const FUEL_COMPONENT_PROPS: Record<string, FuelComponentProps> = {
  Water: { mw: 18.02, lhvMjKg: 0.0, o2: 0.0, h2o: 0.0, co2: 0.0 },
  Hydrogen_Sulfide: { mw: 34.08, lhvMjKg: 15.22, o2: 1.5, h2o: 1.0, co2: 0.0 },
  Hydrogen: { mw: 2.02, lhvMjKg: 120.97, o2: 0.5, h2o: 1.0, co2: 0.0 },
  Nitrogen: { mw: 28.0, lhvMjKg: 0.0, o2: 0.0, h2o: 0.0, co2: 0.0 },
  Oxygen_Argon: { mw: 32.0, lhvMjKg: 0.0, o2: -1.0, h2o: 0.0, co2: 0.0 },
  CO2: { mw: 44.0, lhvMjKg: 0.0, o2: 0.0, h2o: 0.0, co2: 0.0 },
  CO: { mw: 28.0, lhvMjKg: 10.11, o2: 0.5, h2o: 0.0, co2: 1.0 },
  Methane: { mw: 16.04, lhvMjKg: 50.01, o2: 2.0, h2o: 2.0, co2: 1.0 },
  Ethane: { mw: 30.06, lhvMjKg: 47.79, o2: 3.5, h2o: 3.0, co2: 2.0 },
  Ethylene: { mw: 28.04, lhvMjKg: 47.2, o2: 3.0, h2o: 2.0, co2: 2.0 },
  Propane: { mw: 44.08, lhvMjKg: 46.36, o2: 5.0, h2o: 4.0, co2: 3.0 },
  Propylene: { mw: 42.06, lhvMjKg: 45.8, o2: 4.5, h2o: 3.0, co2: 3.0 },
  Isobutane: { mw: 58.12, lhvMjKg: 45.72, o2: 6.5, h2o: 5.0, co2: 4.0 },
  "n-Butane": { mw: 58.12, lhvMjKg: 45.72, o2: 6.5, h2o: 5.0, co2: 4.0 },
  Butene: { mw: 56.1, lhvMjKg: 45.3, o2: 6.0, h2o: 4.0, co2: 4.0 },
  Isopentane: { mw: 72.15, lhvMjKg: 45.24, o2: 8.0, h2o: 6.0, co2: 5.0 },
  "n-Pentane": { mw: 72.15, lhvMjKg: 45.24, o2: 8.0, h2o: 6.0, co2: 5.0 },
  "C6+": { mw: 86.18, lhvMjKg: 44.75, o2: 9.5, h2o: 7.0, co2: 6.0 },
};

export interface FuelGasCase {
  averageMw: number;
  lhvMjKg: number;
  fractions: Record<string, number>;
}

export const FUEL_GAS_CASES: Record<string, FuelGasCase> = {
  "Sheet Reference Case (83.64%)": {
    averageMw: 13.83,
    lhvMjKg: 49.469,
    fractions: {
      Water: 0,
      Hydrogen_Sulfide: 0,
      Hydrogen: 0.40976,
      Nitrogen: 0.01406,
      Oxygen_Argon: 0,
      CO2: 0,
      CO: 0,
      Methane: 0.45345,
      Ethane: 0.07221,
      Ethylene: 0,
      Propane: 0.02689,
      Propylene: 0,
      Isobutane: 0,
      "n-Butane": 0,
      Butene: 0,
      Isopentane: 0,
      "n-Pentane": 0,
      "C6+": 0.02363,
    },
  },
  "Summer EOR": {
    averageMw: 12.9689,
    lhvMjKg: 50.6902,
    fractions: {
      Water: 0.0034,
      Hydrogen_Sulfide: 0,
      Hydrogen: 0.3809,
      Nitrogen: 0.0188,
      Oxygen_Argon: 0.0009,
      CO2: 0.0013,
      CO: 0.0003,
      Methane: 0.4983,
      Ethane: 0.0727,
      Ethylene: 0.0017,
      Propane: 0.0101,
      Propylene: 0.0002,
      Isobutane: 0.0013,
      "n-Butane": 0.0028,
      Butene: 0,
      Isopentane: 0.0015,
      "n-Pentane": 0.0029,
      "C6+": 0.003,
    },
  },
  "Winter SOR": {
    averageMw: 13.6498,
    lhvMjKg: 50.157,
    fractions: {
      Water: 0.0029,
      Hydrogen_Sulfide: 0,
      Hydrogen: 0.328,
      Nitrogen: 0.0183,
      Oxygen_Argon: 0.0007,
      CO2: 0.0018,
      CO: 0.0002,
      Methane: 0.5567,
      Ethane: 0.0671,
      Ethylene: 0.0015,
      Propane: 0.0106,
      Propylene: 0.0002,
      Isobutane: 0.0017,
      "n-Butane": 0.0029,
      Butene: 0,
      Isopentane: 0.0014,
      "n-Pentane": 0.0026,
      "C6+": 0.0027,
    },
  },
  "H2 Rich Case Winter SOR": {
    averageMw: 11.137,
    lhvMjKg: 53.1777,
    fractions: {
      Water: 0.0023,
      Hydrogen_Sulfide: 0,
      Hydrogen: 0.5728,
      Nitrogen: 0.018,
      Oxygen_Argon: 0.0008,
      CO2: 0.0001,
      CO: 0.0002,
      Methane: 0.2845,
      Ethane: 0.0671,
      Ethylene: 0.0016,
      Propane: 0.032,
      Propylene: 0,
      Isobutane: 0.0018,
      "n-Butane": 0.0125,
      Butene: 0,
      Isopentane: 0.0011,
      "n-Pentane": 0.0014,
      "C6+": 0.0032,
    },
  },
  "C3 Rich Case Winter EOR": {
    averageMw: 21.0556,
    lhvMjKg: 47.4538,
    fractions: {
      Water: 0.0025,
      Hydrogen_Sulfide: 0,
      Hydrogen: 0.1996,
      Nitrogen: 0.0235,
      Oxygen_Argon: 0.0013,
      CO2: 0.0003,
      CO: 0.0004,
      Methane: 0.4849,
      Ethane: 0.1177,
      Ethylene: 0.0027,
      Propane: 0.0992,
      Propylene: 0.0019,
      Isobutane: 0.0244,
      "n-Butane": 0.0288,
      Butene: 0.004,
      Isopentane: 0.0019,
      "n-Pentane": 0.0059,
      "C6+": 0.0046,
    },
  },
  "Type Natural Gas (Startup, pilot)": {
    averageMw: 17.0601,
    lhvMjKg: 47.7802,
    fractions: {
      Water: 0,
      Hydrogen_Sulfide: 0,
      Hydrogen: 0,
      Nitrogen: 0.0164,
      Oxygen_Argon: 0,
      CO2: 0.0053,
      CO: 0,
      Methane: 0.9429,
      Ethane: 0.0267,
      Ethylene: 0,
      Propane: 0.0058,
      Propylene: 0,
      Isobutane: 0.001,
      "n-Butane": 0.0011,
      Butene: 0,
      Isopentane: 0.0003,
      "n-Pentane": 0.0002,
      "C6+": 0.0003,
    },
  },
  "Average Fuel Gas": {
    averageMw: 15.0834,
    lhvMjKg: 49.3242,
    fractions: {
      Water: 0.001,
      Hydrogen_Sulfide: 0.00099,
      Hydrogen: 0.34242,
      Nitrogen: 0.01548,
      Oxygen_Argon: 0.00116,
      CO2: 0.0024,
      CO: 0.00074,
      Methane: 0.52052,
      Ethane: 0.08416,
      Ethylene: 0.00036,
      Propane: 0.02416,
      Propylene: 0.0003,
      Isobutane: 0.0024,
      "n-Butane": 0.0029,
      Butene: 0.0015,
      Isopentane: 0.001,
      "n-Pentane": 0.0011,
      "C6+": 0.0146,
    },
  },
};

// Physical constants (live engine)
export const T_REF_DEFAULT_C = 15.0;
export const CP_FUEL_GAS_KJKGK = 2.6038;
export const CP_COMBUSTION_AIR_KJKGK = 1.006;
export const CP_FLUE_GAS_KJKGK = 1.062;
export const CP_FLUE_GAS_PTC4_KJKGK = 1.08;
export const CP_VAPOR_KJKGK = 2.0;
export const O2_VOL_FRAC_AIR = 0.21;
export const N2_VOL_FRAC_AIR = 0.79;
export const O2_MW = 32.0;
export const N2_MW = 28.0;
