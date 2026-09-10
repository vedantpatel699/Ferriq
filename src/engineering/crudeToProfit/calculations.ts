// Workbook primitives plus the current once-through routing model.
// runWorkbookModel is retained for historical audit only.

import {
  CRUDES,
  PRIMARY_CUTS,
  RHC_PRODUCTS,
  PRODUCTS,
  SIMDIST_STREAMS,
  CRUDE_PROPERTIES,
  M3_TO_BBL,
  RHC_FEED_DENSITY_KG_M3,
  RHC_PRODUCT_DENSITY_KG_M3,
  LPG_LIQUID_DENSITY_KG_M3,
  FCC_FEED_DENSITY_KG_M3,
  LC_FINER_YIELD_WTPCT,
  GAS_OIL_KEYS,
  GAS_OIL_SPLIT,
  FCC_YIELD_WTPCT,
  FCC_PRODUCT_DENSITY_KG_M3,
  FCC_PRODUCT_RANGE_C,
  PRODUCT_RANGE_C,
  RESIDUE_UNIT_LABELS,
  GAS_OIL_UNIT_LABELS,
  HOURS_PER_DAY,
  OPERATING_DAYS_PER_YEAR,
  type CrudeCode,
  type ProductCode,
  type ResidueUnit,
  type GasOilUnit,
  type CrudeToProfitConfig,
} from "./data";

export function zeroSlate(): Record<ProductCode, number> {
  const z = {} as Record<ProductCode, number>;
  for (const p of PRODUCTS) z[p] = 0.0;
  return z;
}

export interface BlendResult {
  per_crude: Record<
    CrudeCode,
    {
      flow_m3hr: number;
      blend_pct: number;
      flow_bblhr: number;
      sulfur_kghr: number;
      density_kg_m3: number;
      sulfur_wtpct: number;
    }
  >;
  total_flow_m3hr: number;
  total_flow_bblhr: number;
  total_sulfur_kghr: number;
}

export function blendCrudes(
  crudeFlows: Partial<Record<CrudeCode, number>>,
): BlendResult {
  let total = 0;
  for (const c of CRUDES) total += crudeFlows[c] || 0.0;
  const perCrude = {} as BlendResult["per_crude"];
  for (const c of CRUDES) {
    const flow = crudeFlows[c] || 0.0;
    const props = CRUDE_PROPERTIES[c];
    perCrude[c] = {
      flow_m3hr: flow,
      blend_pct: total ? (flow / total) * 100.0 : 0.0,
      flow_bblhr: flow * M3_TO_BBL,
      sulfur_kghr: (props.density_kg_m3 * flow * props.sulfur_wtpct) / 100.0,
      density_kg_m3: props.density_kg_m3,
      sulfur_wtpct: props.sulfur_wtpct,
    };
  }
  let totalSulfur = 0;
  for (const c of CRUDES) totalSulfur += perCrude[c].sulfur_kghr;
  return {
    per_crude: perCrude,
    total_flow_m3hr: total,
    total_flow_bblhr: total * M3_TO_BBL,
    total_sulfur_kghr: totalSulfur,
  };
}

export interface PrimarySplitResult {
  per_crude: Record<CrudeCode, Record<string, number>>;
  totals_m3hr: Record<string, number>;
  hydrotreater_feed_m3hr: number;
  hydrocracker_feed_m3hr: number;
}

export function primarySplit(
  crudeFlows: Partial<Record<CrudeCode, number>>,
  cfg: CrudeToProfitConfig,
): PrimarySplitResult {
  const table = cfg.primary_yield_volpct;
  const perCrude = {} as PrimarySplitResult["per_crude"];
  const totals: Record<string, number> = {};
  for (const cut of PRIMARY_CUTS) totals[cut] = 0.0;
  for (const c of CRUDES) {
    const flow = crudeFlows[c] || 0.0;
    const yields = table[c];
    const cuts: Record<string, number> = {};
    for (const cut of PRIMARY_CUTS) cuts[cut] = (flow * yields[cut]) / 100.0;
    cuts.vgo = cuts.lvgo + cuts.mvgo + cuts.hvgo;
    perCrude[c] = cuts;
    for (const cut of PRIMARY_CUTS) totals[cut] += cuts[cut];
  }
  return {
    per_crude: perCrude,
    totals_m3hr: totals,
    hydrotreater_feed_m3hr: totals.naphtha + totals.ago,
    hydrocracker_feed_m3hr: totals.lvgo + totals.mvgo + totals.hvgo,
  };
}

/** Delayed-coker yield correlation (published carbon-residue correlations):
 *  gas = 7.80 + 0.144·CCR; naphtha = 11.29 + 0.343·CCR; coke = 1.60·CCR;
 *  gas oil = remainder (closes to 100 by construction). */
export function cokerYieldWtpct(ccr: number): Record<string, number> {
  const gas = 7.8 + 0.144 * ccr;
  const naphtha = 11.29 + 0.343 * ccr;
  const coke = 1.6 * ccr;
  const gasOil = 100.0 - (gas + naphtha + coke);
  const out: Record<string, number> = {
    rhc_naphtha: naphtha,
    unconverted_residue: 0.0,
    lpg_fuel_gas: gas,
    coke,
  };
  for (const k of GAS_OIL_KEYS) out[k] = gasOil * GAS_OIL_SPLIT[k];
  return out;
}

export function residueUnitYieldWtpct(
  unit: ResidueUnit,
  cfg: CrudeToProfitConfig,
): Record<string, number> {
  if (unit === "lc_finer") return { ...LC_FINER_YIELD_WTPCT };
  if (unit === "delayed_coker")
    return cokerYieldWtpct(cfg.coker_feed_ccr_wtpct);
  throw new Error(`unknown residue unit: ${unit}`);
}

export interface RhcSplitResult {
  [product: string]: number | RhcByproducts;
  byproducts: RhcByproducts;
}
export interface RhcByproducts {
  unit: ResidueUnit;
  unit_label: string;
  feed_m3hr: number;
  feed_kghr: number;
  coke_kghr: number;
  coke_wtpct: number;
  lpg_fuel_gas_kghr: number;
  lpg_fuel_gas_wtpct: number;
  lpg_recovered_m3hr: number;
  yield_sum_wtpct: number;
  yield_wtpct: Record<string, number>;
}

/** Residue conversion unit split (LC Finer or delayed coker). Coke is a
 *  solid and LPG/fuel gas is a vapour — neither belongs in the liquid
 *  volume balance; both are carried in mass under `byproducts` (a coker
 *  turns roughly a quarter of its feed to coke, so dropping it would lose
 *  a quarter of the feed). */
export function rhcSplit(
  vrM3hr: number,
  cfg: CrudeToProfitConfig,
  unit?: ResidueUnit,
): RhcSplitResult {
  const resolvedUnit = unit || cfg.residue_unit;
  const table = residueUnitYieldWtpct(resolvedUnit, cfg);
  const feedKghr = vrM3hr * RHC_FEED_DENSITY_KG_M3;
  const factor = feedKghr / RHC_PRODUCT_DENSITY_KG_M3;
  const out: Record<string, number> = {};
  for (const p of RHC_PRODUCTS) out[p] = (factor * (table[p] || 0)) / 100.0;
  const cokePct = table.coke || 0,
    gasPct = table.lpg_fuel_gas || 0;
  const byproducts: RhcByproducts = {
    unit: resolvedUnit,
    unit_label: RESIDUE_UNIT_LABELS[resolvedUnit],
    feed_m3hr: vrM3hr,
    feed_kghr: feedKghr,
    coke_kghr: (feedKghr * cokePct) / 100.0,
    coke_wtpct: cokePct,
    lpg_fuel_gas_kghr: (feedKghr * gasPct) / 100.0,
    lpg_fuel_gas_wtpct: gasPct,
    lpg_recovered_m3hr:
      (((feedKghr * gasPct) / 100.0) * cfg.lpg_fuel_gas_recovered) /
      LPG_LIQUID_DENSITY_KG_M3,
    yield_sum_wtpct: Object.values(table).reduce((a, b) => a + b, 0),
    yield_wtpct: table,
  };
  return { ...out, byproducts };
}

export function simdistStreamFeeds(
  primaryTotals: Record<string, number>,
  rhcProducts: RhcSplitResult,
): Record<string, number> {
  return {
    srvr: 0.0,
    diesel: rhcProducts.diesel as number,
    naphtha:
      primaryTotals.naphtha +
      primaryTotals.ago +
      (rhcProducts.rhc_naphtha as number),
    lvgo: primaryTotals.lvgo + (rhcProducts.rhc_lvgo as number),
    mvgo: primaryTotals.mvgo + (rhcProducts.rhc_mvgo as number),
    hvgo: primaryTotals.hvgo,
    crvr: 0.0,
  };
}

export interface SimdistResult {
  per_stream: Record<string, Record<ProductCode, number>>;
  totals_m3hr: Record<ProductCode, number>;
}

export function simdistDirectProducts(
  streamFeeds: Record<string, number>,
  cfg: CrudeToProfitConfig,
): SimdistResult {
  const splits = cfg.simdist_split_volpct;
  const perStream = {} as SimdistResult["per_stream"];
  const totals = zeroSlate();
  for (const stream of SIMDIST_STREAMS) {
    const feed = streamFeeds[stream] || 0.0;
    const table = splits[stream];
    const cuts = {} as Record<ProductCode, number>;
    for (const p of PRODUCTS) cuts[p] = (feed * (table[p] || 0)) / 100.0;
    perStream[stream] = cuts;
    for (const p of PRODUCTS) totals[p] += cuts[p];
  }
  return { per_stream: perStream, totals_m3hr: totals };
}

/** Spread one FCC product across this model's cuts by boiling-range
 *  overlap (assumes material is even across a product's boiling range,
 *  which a real distillation curve is not — good enough to compare
 *  processes, not to quote a single cut in isolation). */
export function rangeOverlapSplit(
  lo: number,
  hi: number,
): Record<ProductCode, number> {
  const shares: Record<string, number> = {};
  for (const [cut, [a, b]] of Object.entries(PRODUCT_RANGE_C)) {
    if (cut === "lpg") continue;
    const ov = Math.max(0, Math.min(hi, b) - Math.max(lo, a));
    if (ov > 0) shares[cut] = ov;
  }
  const tot = Object.values(shares).reduce((x, y) => x + y, 0);
  return Object.fromEntries(
    Object.entries(shares).map(([k, v]) => [k, v / tot]),
  ) as Record<ProductCode, number>;
}

export function fccGasOilYieldVolpct(): Record<ProductCode, number> {
  const vol: Record<string, number> = {};
  for (const p of ["lpg", "gasoline", "lco", "slurry"]) {
    vol[p] =
      (FCC_YIELD_WTPCT[p as keyof typeof FCC_YIELD_WTPCT] *
        FCC_FEED_DENSITY_KG_M3) /
      FCC_PRODUCT_DENSITY_KG_M3[p];
  }
  const slate = zeroSlate();
  slate.lpg = vol.lpg;
  for (const p of ["gasoline", "lco", "slurry"] as const) {
    const [lo, hi] = FCC_PRODUCT_RANGE_C[p];
    const shares = rangeOverlapSplit(lo, hi);
    for (const [cut, sh] of Object.entries(shares))
      slate[cut as ProductCode] += vol[p] * sh;
  }
  return slate;
}

const FCC_GAS_OIL_YIELD_VOLPCT = fccGasOilYieldVolpct();

export interface HchtByproducts {
  unit: GasOilUnit;
  unit_label: string;
  feed_m3hr: number;
  feed_kghr?: number;
  coke_kghr: number;
  coke_wtpct?: number;
  dry_gas_kghr: number;
  dry_gas_wtpct?: number;
  liquid_volume_yield_volpct: number;
}
export type HchtSplitResult = Record<ProductCode, number> & {
  byproducts: HchtByproducts;
};

/** Gas-oil conversion unit (hydrocracker/hydrotreater on UCO, or FCC). */
export function hchtSplit(
  ucoM3hr: number,
  cfg: CrudeToProfitConfig,
  unit?: GasOilUnit,
): HchtSplitResult {
  const resolvedUnit = unit || cfg.gas_oil_unit;
  const out = {} as Record<ProductCode, number>;

  if (resolvedUnit === "fcc") {
    for (const p of PRODUCTS)
      out[p] = (ucoM3hr * FCC_GAS_OIL_YIELD_VOLPCT[p]) / 100.0;
    const feedKghr = ucoM3hr * FCC_FEED_DENSITY_KG_M3;
    const byproducts: HchtByproducts = {
      unit: resolvedUnit,
      unit_label: GAS_OIL_UNIT_LABELS[resolvedUnit],
      feed_m3hr: ucoM3hr,
      feed_kghr: feedKghr,
      coke_kghr: (feedKghr * FCC_YIELD_WTPCT.coke) / 100.0,
      coke_wtpct: FCC_YIELD_WTPCT.coke,
      dry_gas_kghr: (feedKghr * FCC_YIELD_WTPCT.dry_gas) / 100.0,
      dry_gas_wtpct: FCC_YIELD_WTPCT.dry_gas,
      liquid_volume_yield_volpct: Object.values(
        FCC_GAS_OIL_YIELD_VOLPCT,
      ).reduce((a, b) => a + b, 0),
    };
    return { ...out, byproducts };
  }

  const y = cfg.hcht_yield_volpct;
  const lpgPct = y.c3 + y.ic4 + y.nc4;
  const pct: Record<ProductCode, number> = {
    lpg: lpgPct,
    naphtha: y.naphtha,
    swing_naphtha: y.swing_naphtha,
    kerosene: y.kerosene,
    diesel: y.diesel,
    swing_diesel: y.swing_diesel,
    uco: y.uco,
  };
  for (const p of PRODUCTS) out[p] = (ucoM3hr * pct[p]) / 100.0;
  const byproducts: HchtByproducts = {
    unit: resolvedUnit,
    unit_label: GAS_OIL_UNIT_LABELS[resolvedUnit],
    feed_m3hr: ucoM3hr,
    coke_kghr: 0.0,
    dry_gas_kghr: 0.0,
    liquid_volume_yield_volpct: Object.values(pct).reduce((a, b) => a + b, 0),
  };
  return { ...out, byproducts };
}

export function finalProductSlate(
  directTotals: Record<ProductCode, number>,
  hcProducts: Record<ProductCode, number>,
  residueByproducts?: RhcByproducts,
): Record<ProductCode, number> {
  const slate = {} as Record<ProductCode, number>;
  for (const p of PRODUCTS) slate[p] = directTotals[p] + hcProducts[p];
  slate.uco = hcProducts.uco; // direct UCO was consumed as HC feed
  if (residueByproducts) slate.lpg += residueByproducts.lpg_recovered_m3hr || 0;
  return slate;
}

export interface EconomicsResult {
  crude_cost_low_cad_hr: number;
  crude_cost_high_cad_hr: number;
  revenue_low_cad_hr: number;
  revenue_high_cad_hr: number;
  margin_low_cad_hr: number;
  margin_high_cad_hr: number;
  margin_low_mcad_yr: number;
  margin_high_mcad_yr: number;
  has_market_case: boolean;
  crude_cost_market_cad_hr?: number;
  revenue_market_cad_hr?: number;
  margin_market_cad_hr?: number;
  margin_market_mcad_yr?: number;
}

/** Three pricing cases: low/high (fixed assumptions, always available,
 *  no network needed) and market (today's live prices — present only
 *  when a price exists for EVERY crude and EVERY product, so a partial
 *  fetch never produces a misleading partial market case). */
export function economics(
  crudeFlows: Partial<Record<CrudeCode, number>>,
  productSlate: Record<ProductCode, number>,
  cfg: CrudeToProfitConfig,
  marketCrude: Partial<Record<CrudeCode, number>> | null,
  marketProduct: Partial<Record<ProductCode, number>> | null,
): EconomicsResult {
  const crudeCost = (prices: Record<CrudeCode, number>) => {
    let s = 0;
    for (const c of CRUDES) s += (crudeFlows[c] || 0.0) * prices[c];
    return s;
  };
  const revenue = (prices: Record<ProductCode, number>) => {
    let s = 0;
    for (const p of PRODUCTS) s += (productSlate[p] || 0.0) * prices[p];
    return s;
  };
  const costLow = crudeCost(cfg.crude_price_low_cad_m3);
  const costHigh = crudeCost(cfg.crude_price_high_cad_m3);
  const revLow = revenue(cfg.product_price_low_cad_m3);
  const revHigh = revenue(cfg.product_price_high_cad_m3);
  const marginLow = revLow - costLow;
  const marginHigh = revHigh - costHigh;
  const annual = (HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR) / 1e6;

  const out: EconomicsResult = {
    crude_cost_low_cad_hr: costLow,
    crude_cost_high_cad_hr: costHigh,
    revenue_low_cad_hr: revLow,
    revenue_high_cad_hr: revHigh,
    margin_low_cad_hr: marginLow,
    margin_high_cad_hr: marginHigh,
    margin_low_mcad_yr: marginLow * annual,
    margin_high_mcad_yr: marginHigh * annual,
    has_market_case: false,
  };

  const haveAll =
    marketCrude &&
    marketProduct &&
    CRUDES.every((c) => marketCrude[c] != null) &&
    PRODUCTS.every((p) => marketProduct[p] != null);
  if (haveAll) {
    const costMarket = crudeCost(marketCrude as Record<CrudeCode, number>);
    const revMarket = revenue(marketProduct as Record<ProductCode, number>);
    const marginMarket = revMarket - costMarket;
    out.crude_cost_market_cad_hr = costMarket;
    out.revenue_market_cad_hr = revMarket;
    out.margin_market_cad_hr = marginMarket;
    out.margin_market_mcad_yr = marginMarket * annual;
    out.has_market_case = true;
  }
  return out;
}

export interface RunModelResult {
  blend: BlendResult;
  primary: PrimarySplitResult;
  rhc_products_m3hr: RhcSplitResult;
  simdist_stream_feeds_m3hr: Record<string, number>;
  direct_products: SimdistResult;
  hc_reactor_products_m3hr: HchtSplitResult;
  product_slate_m3hr: Record<ProductCode, number>;
  workbook_slate_m3hr: Record<ProductCode, number>;
  byproducts: RhcByproducts;
  residue_unit: ResidueUnit;
  gas_oil_unit: GasOilUnit;
  gas_oil_byproducts: HchtByproducts;
  economics: EconomicsResult;
}

/** Historical workbook chain, retained only for audit comparisons. */
export function runWorkbookModel(
  crudeFlows: Partial<Record<CrudeCode, number>>,
  cfg: CrudeToProfitConfig,
  marketCrude: Partial<Record<CrudeCode, number>> | null,
  marketProduct: Partial<Record<ProductCode, number>> | null,
  residueUnit?: ResidueUnit,
  gasOilUnit?: GasOilUnit,
): RunModelResult {
  const blend = blendCrudes(crudeFlows);
  const primary = primarySplit(crudeFlows, cfg);
  const rhc = rhcSplit(primary.totals_m3hr.vr, cfg, residueUnit);
  const byproducts = rhc.byproducts;
  const feeds = simdistStreamFeeds(primary.totals_m3hr, rhc);
  const direct = simdistDirectProducts(feeds, cfg);
  const hc = hchtSplit(direct.totals_m3hr.uco, cfg, gasOilUnit);
  const gasOilByproducts = hc.byproducts;
  const workbookSlate = finalProductSlate(direct.totals_m3hr, hc);
  const slate = finalProductSlate(direct.totals_m3hr, hc, byproducts);
  const econ = economics(crudeFlows, slate, cfg, marketCrude, marketProduct);
  return {
    blend,
    primary,
    rhc_products_m3hr: rhc,
    simdist_stream_feeds_m3hr: feeds,
    direct_products: direct,
    hc_reactor_products_m3hr: hc,
    product_slate_m3hr: slate,
    workbook_slate_m3hr: workbookSlate,
    byproducts,
    residue_unit: byproducts.unit,
    gas_oil_unit: gasOilByproducts.unit,
    gas_oil_byproducts: gasOilByproducts,
    economics: econ,
  };
}

export interface RoutedModelResult extends RunModelResult {
  routing: {
    stream: string;
    destination: string;
    flow_m3hr: number;
    mass_kghr: number;
  }[];
  unpriced_residue_m3hr: number;
  routing_basis: string;
}

/** Once-through screening network. Residue never enters a gas-oil unit.
 * Source yield tables remain illustrative; no inter-unit recycle is assumed. */
export function runModel(
  crudeFlows: Partial<Record<CrudeCode, number>>,
  cfg: CrudeToProfitConfig,
  marketCrude: Partial<Record<CrudeCode, number>> | null,
  marketProduct: Partial<Record<ProductCode, number>> | null,
  residueUnit: ResidueUnit = cfg.residue_unit,
  gasOilUnit: GasOilUnit = cfg.gas_oil_unit,
): RoutedModelResult {
  if (
    !(residueUnit in RESIDUE_UNIT_LABELS) ||
    !(gasOilUnit in GAS_OIL_UNIT_LABELS)
  )
    throw Error("Unknown conversion unit");
  if (Object.values(crudeFlows).some((v) => !Number.isFinite(v) || v < 0))
    throw Error("Feed flows must be finite and nonnegative");
  if (
    !Number.isFinite(cfg.lpg_fuel_gas_recovered) ||
    cfg.lpg_fuel_gas_recovered < 0 ||
    cfg.lpg_fuel_gas_recovered > 1
  )
    throw Error("LPG recovery must be between 0 and 1");
  const blend = blendCrudes(crudeFlows),
    primary = primarySplit(crudeFlows, cfg);
  const vr = primary.totals_m3hr.vr;
  let rhc = rhcSplit(residueUnit === "lc_finer" ? vr : 0, cfg, "lc_finer");
  let residueGasOil = 0,
    cokerNaphtha = 0,
    heldResidue = 0;
  if (residueUnit === "none") {
    heldResidue = vr;
    rhc.byproducts = {
      ...rhc.byproducts,
      unit: "none",
      unit_label: RESIDUE_UNIT_LABELS.none,
      yield_sum_wtpct: 0,
      yield_wtpct: {},
    };
  } else if (residueUnit === "delayed_coker") {
    const ccr = cfg.coker_feed_ccr_wtpct;
    const gas = 7.8 + 0.144 * ccr,
      naphtha = 11.29 + 0.343 * ccr,
      coke = 1.6 * ccr;
    const gasOil = 100 - gas - naphtha - coke;
    if (!Number.isFinite(ccr) || ccr < 0 || gasOil < 0)
      throw Error("Coker CCR produces invalid yields");
    const mass = vr * RHC_FEED_DENSITY_KG_M3,
      factor = mass / RHC_PRODUCT_DENSITY_KG_M3 / 100;
    residueGasOil = factor * gasOil;
    cokerNaphtha = factor * naphtha;
    rhc.rhc_naphtha = cokerNaphtha;
    rhc.gas_oil_pool = residueGasOil;
    rhc.byproducts = {
      ...rhc.byproducts,
      unit: residueUnit,
      unit_label: RESIDUE_UNIT_LABELS[residueUnit],
      feed_m3hr: vr,
      feed_kghr: mass,
      coke_kghr: (mass * coke) / 100,
      coke_wtpct: coke,
      lpg_fuel_gas_kghr: (mass * gas) / 100,
      lpg_fuel_gas_wtpct: gas,
      lpg_recovered_m3hr:
        (((mass * gas) / 100) * cfg.lpg_fuel_gas_recovered) /
        LPG_LIQUID_DENSITY_KG_M3,
      yield_sum_wtpct: 100,
      yield_wtpct: { naphtha, gas_oil_pool: gasOil, lpg_fuel_gas: gas, coke },
    };
  } else {
    residueGasOil =
      Number(rhc.rhc_lvgo) + Number(rhc.rhc_mvgo) + Number(rhc.rhc_hvgo);
    heldResidue = Number(rhc.unconverted_residue);
  }
  // Keep the client's primary light-cut distribution; do not subdivide VGO
  // or coker gas oil using unrelated LC Finer/SimDist cut ratios.
  const feeds = {
    srvr: 0,
    crvr: 0,
    lvgo: 0,
    mvgo: 0,
    hvgo: 0,
    naphtha:
      primary.totals_m3hr.naphtha +
      primary.totals_m3hr.ago +
      (residueUnit === "lc_finer" ? Number(rhc.rhc_naphtha) : 0),
    diesel: residueUnit === "lc_finer" ? Number(rhc.diesel) : 0,
  };
  const direct = simdistDirectProducts(feeds, cfg);
  direct.totals_m3hr.naphtha += cokerNaphtha;
  direct.per_stream.coker_naphtha = { ...zeroSlate(), naphtha: cokerNaphtha };
  const straightVgo = primary.totals_m3hr.vgo,
    heavyTail = direct.totals_m3hr.uco;
  const pool = straightVgo + residueGasOil + heavyTail;
  const poolMass =
    straightVgo * FCC_FEED_DENSITY_KG_M3 +
    (residueGasOil + heavyTail) * RHC_PRODUCT_DENSITY_KG_M3;
  let hc: HchtSplitResult;
  if (gasOilUnit === "none") {
    hc = {
      ...zeroSlate(),
      uco: pool,
      byproducts: {
        unit: "none",
        unit_label: GAS_OIL_UNIT_LABELS.none,
        feed_m3hr: 0,
        feed_kghr: 0,
        coke_kghr: 0,
        dry_gas_kghr: 0,
        liquid_volume_yield_volpct: 0,
      },
    };
  } else if (gasOilUnit === "fcc") {
    // Native FCC product pools; do not sell FCC gasoline as jet fuel based
    // on boiling overlap. Existing prices are explicitly named pool proxies.
    const vol = (p: "lpg" | "gasoline" | "lco" | "slurry") =>
      (poolMass * FCC_YIELD_WTPCT[p]) / 100 / FCC_PRODUCT_DENSITY_KG_M3[p];
    const slate = {
      ...zeroSlate(),
      lpg: vol("lpg"),
      naphtha: vol("gasoline"),
      uco: vol("lco") + vol("slurry"),
    };
    hc = {
      ...slate,
      byproducts: {
        unit: "fcc",
        unit_label: GAS_OIL_UNIT_LABELS.fcc,
        feed_m3hr: pool,
        feed_kghr: poolMass,
        coke_kghr: poolMass * 0.06,
        coke_wtpct: 6,
        dry_gas_kghr: poolMass * 0.04,
        dry_gas_wtpct: 4,
        liquid_volume_yield_volpct: pool
          ? (Object.values(slate).reduce((a, b) => a + b, 0) / pool) * 100
          : 0,
      },
    };
  } else hc = hchtSplit(pool, cfg, "hydrocracker");
  const workbookSlate = finalProductSlate(direct.totals_m3hr, hc);
  const slate = finalProductSlate(direct.totals_m3hr, hc, rhc.byproducts);
  const destination =
    gasOilUnit === "none"
      ? "Held gas oil (UCO price proxy)"
      : GAS_OIL_UNIT_LABELS[gasOilUnit];
  return {
    blend,
    primary,
    rhc_products_m3hr: rhc,
    simdist_stream_feeds_m3hr: feeds,
    direct_products: direct,
    hc_reactor_products_m3hr: hc,
    product_slate_m3hr: slate,
    workbook_slate_m3hr: workbookSlate,
    byproducts: rhc.byproducts,
    residue_unit: residueUnit,
    gas_oil_unit: gasOilUnit,
    gas_oil_byproducts: hc.byproducts,
    economics: economics(crudeFlows, slate, cfg, marketCrude, marketProduct),
    unpriced_residue_m3hr: heldResidue,
    routing_basis:
      "Illustrative once-through feed-specific routing; fixed yield and density assumptions",
    routing: [
      {
        stream: "Primary vacuum residue",
        destination:
          residueUnit === "none"
            ? "Held residue (unpriced)"
            : RESIDUE_UNIT_LABELS[residueUnit],
        flow_m3hr: vr,
        mass_kghr: vr * RHC_FEED_DENSITY_KG_M3,
      },
      {
        stream: "Straight-run VGO",
        destination,
        flow_m3hr: straightVgo,
        mass_kghr: straightVgo * FCC_FEED_DENSITY_KG_M3,
      },
      {
        stream:
          residueUnit === "delayed_coker"
            ? "Coker gas-oil pool (cut split unknown)"
            : "LC Finer gas-oil fractions",
        destination,
        flow_m3hr: residueGasOil,
        mass_kghr: residueGasOil * RHC_PRODUCT_DENSITY_KG_M3,
      },
      {
        stream: "Distillate heavy tail",
        destination,
        flow_m3hr: heavyTail,
        mass_kghr: heavyTail * RHC_PRODUCT_DENSITY_KG_M3,
      },
      {
        stream: "Terminal residue inventory",
        destination: "Held residue (unpriced)",
        flow_m3hr: heldResidue,
        mass_kghr:
          heldResidue *
          (residueUnit === "none"
            ? RHC_FEED_DENSITY_KG_M3
            : RHC_PRODUCT_DENSITY_KG_M3),
      },
    ],
  };
}
