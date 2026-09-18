"""Crude to Profit: once-through routing and CAD revenue/cost reconciliation.

Inputs: flows in m3/h; optional market prices in CAD/m3. Output includes
mass/volume balances, Low/High/market cases, annual values and interval totals.
Operating cost is revenue percentage OR itemized costs, never both.
Reject negative/nonfinite flows, invalid yield totals and invalid configuration.
Missing market prices leave the market case unavailable; no network is used.
Run: python engines/crude_to_profit_engine.py examples/crude-to-profit.input.json
"""

import csv
import math
import json

# =============================================================================
# 1. CONFIGURATION  (swappable per refinery type)
# =============================================================================
# Yield data changes with the refinery. All four yield tables live here so a
# caller can pass a different config and get correct results. Defaults are the
# documented workbook and open-source assumptions.

CRUDES = ("OSH", "SHD", "AWB", "SCO", "FRB")

PRIMARY_CUTS = ("naphtha", "ago", "vgo", "vr", "lvgo", "mvgo", "hvgo")

RHC_PRODUCTS = ("rhc_naphtha", "diesel", "rhc_lvgo", "rhc_mvgo",
                "rhc_hvgo", "unconverted_residue")

# The seven finished product cuts, in workbook column order (SimDist Z..AF).
PRODUCTS = ("lpg", "naphtha", "swing_naphtha", "kerosene",
            "diesel", "swing_diesel", "uco")

PRODUCT_LABELS = {
    "lpg":            "LPG",
    "naphtha":        "Naphtha (C5 to 128 C)",
    "swing_naphtha":  "Swing Naphtha (128 to 145 C)",
    "kerosene":       "Kerosene (145 to 277 C)",
    "diesel":         "Diesel (277 to 340 C)",
    "swing_diesel":   "Swing Diesel (340 to 385 C)",
    "uco":            "UCO (above 385 C)",
}

# Intermediate streams carried on the SimDist sheet, in workbook row order.
SIMDIST_STREAMS = ("srvr", "diesel", "naphtha", "lvgo", "mvgo", "hvgo", "crvr")

DEFAULT_CONFIG = {

    # -- Table 1: primary assay yield, vol % of each crude  (Sheet1 rows 11-17)
    "primary_yield_volpct": {
        #        naphtha  ago    vgo    vr    lvgo   mvgo   hvgo
        "OSH": {"naphtha": 9.8,  "ago": 18.70, "vgo": 63.40, "vr":  8.30,
                "lvgo": 11.00, "mvgo": 30.90, "hvgo": 21.50},
        "SHD": {"naphtha": 25.8, "ago": 12.00, "vgo": 22.40, "vr": 39.10,
                "lvgo":  4.00, "mvgo":  9.50, "hvgo":  8.90},
        "AWB": {"naphtha": 24.0, "ago": 10.10, "vgo": 22.90, "vr": 42.00,
                "lvgo":  3.60, "mvgo":  9.50, "hvgo":  9.80},
        "SCO": {"naphtha": 16.2, "ago": 35.11, "vgo": 40.54, "vr":  5.29,
                "lvgo": 10.18, "mvgo": 18.31, "hvgo": 12.05},
        "FRB": {"naphtha": 22.0, "ago": 12.20, "vgo": 25.10, "vr": 40.40,
                "lvgo":  4.10, "mvgo": 10.60, "hvgo": 10.40},
    },

    # -- Table 2: residue hydrocracker yield, wt % of VR feed
    #    (Sheet1 O12:O17, drives rows 26-31)
    "rhc_yield_wtpct": {
        "rhc_naphtha": 14.13,
        "diesel":      23.95,
        "rhc_lvgo":    12.32,
        "rhc_mvgo":     9.78,
        "rhc_hvgo":     2.44,
        "unconverted_residue": 25.39,
    },

    # -- Which residue conversion unit the vacuum residue goes to.
    #    "lc_finer" | "delayed_coker".
    "residue_unit": "lc_finer",

    # -- Which gas oil conversion unit the unconverted oil goes to.
    #    "hydrocracker" | "fcc". See GAS_OIL_UNIT_LABELS.
    "gas_oil_unit": "hydrocracker",

    # -- Carbon residue of the vacuum residue feed, wt%. Drives the whole
    #    delayed coker slate through the published correlations. Published
    #    vacuum residues run 15-30 wt%, higher for bitumen-derived feeds.
    "coker_feed_ccr_wtpct": 15.0,

    # -- Fraction of the residue unit's LPG/fuel gas stream recovered and
    #    sold rather than burned as refinery fuel. 0 sells none, 1 sells all.
    "lpg_fuel_gas_recovered": 0.0, # No saleable LPG credit without a verified recovery split.

    # -- Table 3: hydrocracker / hydrotreater yield  (Sheet1 M19:P28)
    #    vol % is what drives the calc; wt % is carried for reference only.
    #    LPG is the C3 + iC4 + nC4 roll-up (workbook SimDist Z4).
    "hcht_yield_volpct": {
        "c3":            1.55,
        "ic4":           2.96,
        "nc4":           1.49,
        "naphtha":      18.94,
        "swing_naphtha": 5.41,
        "kerosene":     43.85,
        "diesel":       20.36,
        "swing_diesel":  9.29,
        "uco":           7.58,
    },
    "hcht_yield_wtpct": {
        "c3":            0.87,
        "ic4":           1.84,
        "nc4":           0.96,
        "naphtha":      14.89,
        "swing_naphtha": 4.55,
        "kerosene":     40.16,
        "diesel":       19.67,
        "swing_diesel":  9.01,
        "uco":           7.53,
    },

    # -- Table 4: SimDist per-stream split into the seven finished cuts, vol %
    #    (SimDist Z..AF on the stream rows 5/7/9/11/13/15/17)
    "simdist_split_volpct": {
        "srvr":    {"lpg": 0, "naphtha":  0, "swing_naphtha":  0, "kerosene":  0,
                    "diesel":  0, "swing_diesel":  0, "uco": 100},
        "diesel":  {"lpg": 0, "naphtha":  0, "swing_naphtha":  0, "kerosene": 45,
                    "diesel": 40, "swing_diesel": 14, "uco":   1},
        "naphtha": {"lpg": 0, "naphtha": 37, "swing_naphtha": 15, "kerosene":  0,
                    "diesel": 48, "swing_diesel":  0, "uco":   0},
        "lvgo":    {"lpg": 0, "naphtha":  0, "swing_naphtha":  0, "kerosene":  2,
                    "diesel": 23, "swing_diesel": 30, "uco":  45},
        "mvgo":    {"lpg": 0, "naphtha":  0, "swing_naphtha":  0, "kerosene":  0,
                    "diesel":  3, "swing_diesel": 15, "uco":  82},
        "hvgo":    {"lpg": 0, "naphtha":  0, "swing_naphtha":  0, "kerosene":  0,
                    "diesel":  0, "swing_diesel":  0, "uco": 100},
        "crvr":    {"lpg": 0, "naphtha":  0, "swing_naphtha":  0, "kerosene":  0,
                    "diesel":  0, "swing_diesel":  0, "uco": 100},
    },

    # -- Cut point (SimDist Y2). Reported diagnostic, see note in section 5.4.
    "cut_point_c": 367.0,

    # -- Crude prices, C$/m3. Low case is a fixed reference price.
    #    TODO: swap the low case for a live or historical feed if one is found.
    "crude_price_low_cad_m3":  {"OSH": 580, "SHD": 500, "AWB": 500,
                                "SCO": 610, "FRB": 500},
    "crude_price_high_cad_m3": {"OSH": 640, "SHD": 570, "AWB": 580,
                                "SCO": 680, "FRB": 570},

    # -- Product prices, C$/m3. Low case is a fixed reference price.
    #    TODO: swap the low case for a live or historical feed if one is found.
    "product_price_low_cad_m3":  {"lpg": 650, "naphtha": 720, "swing_naphtha": 760,
                                  "kerosene": 1150, "diesel": 1100,
                                  "swing_diesel": 1000, "uco": 520},
    "product_price_high_cad_m3": {"lpg": 780, "naphtha": 810, "swing_naphtha": 850,
                                  "kerosene": 1300, "diesel": 1280,
                                  "swing_diesel": 1150, "uco": 650},

    # -- Benchmark differentials, C$/m3, applied to a live benchmark price.
    #    Light synthetic streams price off WTI; heavy dilbit off WCS. See
    #    section 3. Only used when live pricing is enabled; the fixed prices
    #    above are what the model uses by default.
    "crude_benchmark": {"OSH": "WTI", "SCO": "WTI",
                        "SHD": "WCS", "AWB": "WCS", "FRB": "WCS"},
    "crude_differential_cad_m3": {"OSH": 0.0, "SHD": 0.0, "AWB": 0.0,
                                  "SCO": 0.0, "FRB": 0.0},

    # -- Product benchmarks. Four of the seven cuts have a public spot price
    #    to price against; the three swing/residual cuts do not and stay on
    #    the fixed reference prices above. Naphtha prices off finished
    #    gasoline because naphtha is a gasoline blendstock - it normally
    #    trades at a discount, so calibrate that differential before relying
    #    on it. All differentials default to zero (raw benchmark).
    "product_benchmark": {
        "lpg":           "propane_usd_gal",
        "naphtha":       "gasoline_usd_gal",
        "swing_naphtha":  None,
        "kerosene":      "jetfuel_usd_gal",
        "diesel":        "ulsd_gc_usd_gal",
        "swing_diesel":   None,
        "uco":            None,
    },
    "product_differential_cad_m3": {p: 0.0 for p in
                                    ("lpg", "naphtha", "swing_naphtha",
                                     "kerosene", "diesel", "swing_diesel",
                                     "uco")},
}


# =============================================================================
# 2. FIXED CONSTANTS  (not user-editable, not part of the swappable config)
# =============================================================================

# Per-crude reference properties. Assay facts, not tuning knobs.
CRUDE_PROPERTIES = {
    "OSH": {"density_kg_m3": 935.7, "sulfur_wtpct": 2.88},
    "SHD": {"density_kg_m3": 919.1, "sulfur_wtpct": 3.87},
    "AWB": {"density_kg_m3": 925.6, "sulfur_wtpct": 4.09},
    "SCO": {"density_kg_m3": 867.3, "sulfur_wtpct": 0.13},
    "FRB": {"density_kg_m3": 922.4, "sulfur_wtpct": 3.75},
}

# CrudeMonitor.ca stream codes. SCO is a generic label in the workbook, not a
# real CrudeMonitor acronym; it is mapped to OSA (Suncor Synthetic A).
CRUDEMONITOR_CODES = {
    "OSH": "OSH",   # Suncor Synthetic H
    "SHD": "SHD",   # Surmont Heavy Dilbit
    "AWB": "AWB",   # Access Western Blend
    "SCO": "OSA",   # Suncor Synthetic A
    "FRB": "FRB",   # Fort Hills Dilbit
}

# Unit conversion, exact by definition (workbook Sheet1 B8).
M3_TO_BBL = 6.290123456790123

# Operating basis for the annualised margin (workbook rows 54-55).
OPERATING_DAYS_PER_YEAR = 330
HOURS_PER_DAY = 24

# Residue Hydrocracker mass-balance densities (workbook Sheet1 L14 and the /862 divisor
# in rows 26-31). Physical properties of that unit, not yield assumptions.
RHC_FEED_DENSITY_KG_M3 = 996.8      # vacuum residue feed
RHC_PRODUCT_DENSITY_KG_M3 = 862.0   # generic product basis

# Liquid density of the recovered LPG stream, kg/m3. A C3/C4 mix at storage
# conditions. Used only to turn the LPG/fuel gas mass stream into a sellable
# volume, never for the gas-oil cuts.
LPG_LIQUID_DENSITY_KG_M3 = 560.0

# =============================================================================
# RESIDUE CONVERSION OPTIONS
# =============================================================================
# The revised workbook offers three units on the vacuum residue stream. All
# three slates below sum to exactly 100 wt%.
#
# SOURCES. The LC Finer column is the workbook's own measured data. The coker
# and FCC slates are built from published refining literature, which is open
# and freely available; nothing here is proprietary or purchased.


def coker_yields_wtpct(ccr, gas_oil_split=None):
    """
    Delayed coker slate, wt% of vacuum residue feed, from published
    carbon-residue correlations:

        gas (C4 and lighter) = 7.80 + 0.144 x CCR
        naphtha              = 11.29 + 0.343 x CCR
        coke                 = 1.60 x CCR
        gas oil              = the remainder

    Closing to 100 is a property of the correlations, not an adjustment.

    The literature splits gas oil 64.5/35.5 light to heavy. That belongs to
    whatever plant the correlation was fitted on. This model uses THIS
    fractionator's own proportions instead, taken from the LC Finer column,
    because the cut points between diesel, LVGO, MVGO and HVGO are a property
    of the fractionator and do not change when the upstream reactor changes.
    """
    gas = 7.80 + 0.144 * ccr
    naphtha = 11.29 + 0.343 * ccr
    coke = 1.60 * ccr
    gas_oil = 100.0 - (gas + naphtha + coke)
    split = gas_oil_split or GAS_OIL_SPLIT
    return {
        "rhc_naphtha": naphtha,
        "diesel":      gas_oil * split["diesel"],
        "rhc_lvgo":    gas_oil * split["rhc_lvgo"],
        "rhc_mvgo":    gas_oil * split["rhc_mvgo"],
        "rhc_hvgo":    gas_oil * split["rhc_hvgo"],
        "unconverted_residue": 0.0,   # a coker leaves no liquid bottoms
        "lpg_fuel_gas": gas,
        "coke":        coke,
    }


LC_FINER_YIELD_WTPCT = {
    "rhc_naphtha": 14.13,
    "diesel":      23.95,
    "rhc_lvgo":    12.32,
    "rhc_mvgo":     9.78,
    "rhc_hvgo":     2.44,
    "unconverted_residue": 25.39,
    "lpg_fuel_gas": 11.99,   # added in the revised sheet; closes the column
    "coke":         0.00,    # a hydrocracker makes no coke
}

_GO = ("diesel", "rhc_lvgo", "rhc_mvgo", "rhc_hvgo")
_GO_TOTAL = sum(LC_FINER_YIELD_WTPCT[k] for k in _GO)
GAS_OIL_SPLIT = {k: LC_FINER_YIELD_WTPCT[k] / _GO_TOTAL for k in _GO}

RESIDUE_UNIT_LABELS = {
    "none": "None (residue bypass)",
    "lc_finer":      "LC Finer",
    "delayed_coker": "Delayed coker",
}

# FCC is deliberately not in that list. An FCC runs on gas oil, not vacuum
# residue, so it belongs on the gas oil stream further down and is selected
# with config["gas_oil_unit"] instead.


def residue_unit_yields_wtpct(unit, config=None):
    """The selected unit's slate, wt% of vacuum residue feed."""
    if unit == "lc_finer":
        return dict(LC_FINER_YIELD_WTPCT)
    if unit == "delayed_coker":
        cfg = _merged_config(config)
        return coker_yields_wtpct(cfg["coker_feed_ccr_wtpct"])
    raise ValueError(f"unknown residue unit {unit!r}. Choose one of "
                     f"{tuple(RESIDUE_UNIT_LABELS)}")


# =============================================================================
# GAS OIL CONVERSION OPTIONS
# =============================================================================
# The unconverted oil leaving the SimDist split is 99.7 % vacuum gas oil. Gas
# oil is the feed an FCC actually runs on, so this is where the FCC belongs.
# Hydrocracking and catalytic cracking are the two competing routes for
# converting gas oil, and they pull the slate in opposite directions:
# hydrocracking adds hydrogen and favours middle distillate, catalytic
# cracking rejects carbon and favours gasoline-range material and LPG.
#
# FEED QUALITY. Catalytic cracking is far more sensitive to feed than
# hydrocracking: nickel and vanadium poison the catalyst and carbon residue
# drives coke make. Gas oil from heavy Canadian crude carries both, so the FCC
# case assumes a hydrotreated feed. That is a real unit and a real capital
# cost, and it is not modelled here.

FCC_FEED_DENSITY_KG_M3 = 900.0

# Historical unsourced FCC assumptions, retained for workbook audit only.
# The active routed engine uses GRACE_FCC_REFERENCE below.
FCC_YIELD_WTPCT = {
    "dry_gas":   4.0,    # historical assumption
    "lpg":      12.0,    # historical assumption
    "gasoline": 47.0,    # historical assumption
    "lco":      21.0,    # historical assumption
    "slurry":   10.0,    # historical assumption
    "coke":      6.0,    # historical assumption
}

GRACE_FCC_REFERENCE = {'source': 'Grace, Strategies for Maximizing FCC Light Cycle Oil, Table 1, p.48', 'url': 'https://grace.com/content/dam/grace-site/english/grace-publications/Grace-The-Essential-Articles-Vol-1_WEB.pdf#page=49', 'conversion_wtpct': 75, 'reactor_exit_f': 970, 'regenerator_f': 1270, 'feed_preheat_f': 299, 'catalyst_oil_ratio': 9.4, 'yield_wtpct': {'dry_gas': 2.2, 'lpg': 13.3, 'gasoline': 51.9, 'lco': 16.7, 'bottoms': 8.6, 'coke': 7.1}, 'unallocated_wtpct': 0.2}
GRACE_FCC_DENSITY_KG_M3 = {'lpg': 560, 'gasoline': 730, 'lco': 950, 'bottoms': 1050}

FCC_PRODUCT_DENSITY_KG_M3 = {"lpg": 560.0, "gasoline": 730.0,
                             "lco": 950.0, "slurry": 1050.0}

# FCC gasoline is cut at 220 C here. Lowering that endpoint moves material out
# of this model's kerosene cut and into naphtha, and the two are priced very
# differently, so it is worth confirming rather than assuming.
FCC_PRODUCT_RANGE_C = {"gasoline": (36, 220), "lco": (220, 350),
                       "slurry": (350, 600)}

# Boiling range of each finished cut in this model, degC.
PRODUCT_RANGE_C = {
    "naphtha":       (36, 128),
    "swing_naphtha": (128, 145),
    "kerosene":      (145, 277),
    "diesel":        (277, 340),
    "swing_diesel":  (340, 385),
    "uco":           (385, 600),
}

GAS_OIL_UNIT_LABELS = {
    "none": "None (gas-oil bypass)",
    "hydrocracker": "Hydrocracker / hydrotreater",
    "fcc":          "Fluid catalytic cracking",
}


def range_overlap_split(lo, hi, cuts=None):
    """
    Spread one FCC product across this model's cuts by boiling range overlap.

    An FCC reports gasoline, cycle oil and slurry; this model reports seven
    cuts by boiling range. They do not line up, so each FCC product is
    apportioned across the model cuts its range covers, in proportion to how
    much of the range each spans.

    THIS ASSUMES MATERIAL IS SPREAD EVENLY ACROSS A PRODUCT'S BOILING RANGE,
    which a real distillation curve is not. It is a first-pass apportionment,
    good enough to compare processes, and it should be replaced with a real
    FCC product distillation curve before any single cut is quoted from it.
    """
    cuts = cuts or PRODUCT_RANGE_C
    shares = {}
    for cut, (a, b) in cuts.items():
        overlap = max(0.0, min(hi, b) - max(lo, a))
        if overlap > 0:
            shares[cut] = overlap
    total = sum(shares.values())
    return {k: v / total for k, v in shares.items()}


def fcc_gas_oil_yield_volpct(wt=None, densities=None, ranges=None):
    """
    FCC slate on this model's seven cuts, vol % of gas oil fed to the unit.

    Three steps, each visible: published wt % of feed, then wt % to vol % on
    each product's own density, then spread across this model's cuts by
    boiling range. The volume total exceeds 100 because cracking makes
    lighter, less dense products from a heavier feed. That gain is real.
    """
    wt = wt or FCC_YIELD_WTPCT
    densities = densities or FCC_PRODUCT_DENSITY_KG_M3
    ranges = ranges or FCC_PRODUCT_RANGE_C
    volume = {p: wt[p] * FCC_FEED_DENSITY_KG_M3 / densities[p]
              for p in ("lpg", "gasoline", "lco", "slurry")}
    slate = {cut: 0.0 for cut in PRODUCT_RANGE_C}
    slate["lpg"] = volume["lpg"]
    for product in ("gasoline", "lco", "slurry"):
        for cut, share in range_overlap_split(*ranges[product]).items():
            slate[cut] += volume[product] * share
    return slate


FCC_GAS_OIL_YIELD_VOLPCT = fcc_gas_oil_yield_volpct()

# Cumulative vol % distilled at each simulated-distillation column.
# IBP is treated as 0 % and FBP as 100 %, consistent with the workbook's
# interpolation formulas.
SIMDIST_PCT_GRID = (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
                    55, 60, 65, 70, 75, 80, 85, 90, 95, 100)


def _merged_config(config=None):
    """Shallow-merge a user config over the defaults."""
    cfg = dict(DEFAULT_CONFIG)
    cfg.update(config or {})
    return cfg


def _zero_slate():
    return {p: 0.0 for p in PRODUCTS}


def load_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


# =============================================================================
# 5. CORE CALCULATION  (each stage is pure and independently testable)
# =============================================================================

# -- 5.1 ------------------------------------------------------------------
def blend_crudes(crude_flows_m3hr):
    """
    Stage 1 - crude blend.  Workbook Sheet1 rows 5-10.

    Combines the five crude streams into one blended feed and reports the
    per-crude share, sulfur load, and volumetric flow in barrels.

      blend %      = flow / total * 100
      sulfur kg/hr = density * flow * sulfur_wt% / 100
      bbl/hr       = flow * 6.290123...        (exact unit conversion)
    """
    total = sum(crude_flows_m3hr.get(c, 0.0) for c in CRUDES)
    per_crude = {}
    for c in CRUDES:
        flow = crude_flows_m3hr.get(c, 0.0)
        props = CRUDE_PROPERTIES[c]
        per_crude[c] = {
            "flow_m3hr": flow,
            "blend_pct": (flow / total * 100.0) if total else 0.0,
            "flow_bblhr": flow * M3_TO_BBL,
            "sulfur_kghr": props["density_kg_m3"] * flow
                           * props["sulfur_wtpct"] / 100.0,
            "density_kg_m3": props["density_kg_m3"],
            "sulfur_wtpct": props["sulfur_wtpct"],
        }
    return {
        "per_crude": per_crude,
        "total_flow_m3hr": total,
        "total_flow_bblhr": total * M3_TO_BBL,
        "total_sulfur_kghr": sum(v["sulfur_kghr"] for v in per_crude.values()),
    }


# -- 5.2 ------------------------------------------------------------------
def primary_split(crude_flows_m3hr, config=None):
    """
    Stage 2 - primary distillation split.  Workbook Sheet1 rows 19-25.

    Applies the per-crude assay yield table to each crude's flow.
      cut m3/hr = flow * yield_vol% / 100

    Note VGO is reported both as its own row and as the sum of the three
    VGO sub-cuts (LVGO + MVGO + HVGO), mirroring the workbook, which
    computes row 21 as D23+D24+D25.
    """
    cfg = _merged_config(config)
    table = cfg["primary_yield_volpct"]

    per_crude, totals = {}, {cut: 0.0 for cut in PRIMARY_CUTS}
    for c in CRUDES:
        flow = crude_flows_m3hr.get(c, 0.0)
        yields = table[c]
        cuts = {cut: flow * yields[cut] / 100.0 for cut in PRIMARY_CUTS}
        # Workbook rebuilds VGO from its three sub-cuts rather than row 13.
        cuts["vgo"] = cuts["lvgo"] + cuts["mvgo"] + cuts["hvgo"]
        per_crude[c] = cuts
        for cut in PRIMARY_CUTS:
            totals[cut] += cuts[cut]

    return {
        "per_crude": per_crude,
        "totals_m3hr": totals,
        # Roll-ups used downstream (workbook rows 33-34).
        "hydrotreater_feed_m3hr": totals["naphtha"] + totals["ago"],
        "hydrocracker_feed_m3hr": totals["lvgo"] + totals["mvgo"] + totals["hvgo"],
    }


# -- 5.3 ------------------------------------------------------------------
def rhc_split(vr_m3hr, config=None, unit=None):
    """
    Stage 3 - the residue conversion unit.  Workbook Sheet1 rows 26-31.

    Converts vacuum residue into naphtha, diesel, three VGO grades, and a
    bottoms stream. The workbook does this as a mass balance and converts back
    to volume on a generic product density:

      product m3/hr = VR m3/hr * 996.8 * (yield_wt% / 100) / 862

    `unit` selects the process: "lc_finer", "delayed_coker" or "fcc".
    Defaults to config["residue_unit"].

    TWO STREAMS THAT ARE NOT LIQUID VOLUME. Coke is a solid and LPG/fuel gas
    is a vapour, so both are carried in the mass balance and reported in kg/hr
    rather than being given an m3/hr in a liquid balance. A coker turns about
    a quarter of its feed into coke, so dropping it would lose a quarter of
    the feed. They arrive under the "byproducts" key.
    """
    cfg = _merged_config(config)
    unit = unit or cfg["residue_unit"]
    table = residue_unit_yields_wtpct(unit, cfg)
    feed_kghr = vr_m3hr * RHC_FEED_DENSITY_KG_M3
    factor = feed_kghr / RHC_PRODUCT_DENSITY_KG_M3

    out = {p: factor * table.get(p, 0.0) / 100.0 for p in RHC_PRODUCTS}
    coke_pct = table.get("coke", 0.0)
    gas_pct = table.get("lpg_fuel_gas", 0.0)
    out["byproducts"] = {
        "unit": unit,
        "unit_label": RESIDUE_UNIT_LABELS[unit],
        "feed_m3hr": vr_m3hr,
        "feed_kghr": feed_kghr,
        "coke_kghr": feed_kghr * coke_pct / 100.0,
        "coke_wtpct": coke_pct,
        "lpg_fuel_gas_kghr": feed_kghr * gas_pct / 100.0,
        "lpg_fuel_gas_wtpct": gas_pct,
        "lpg_recovered_m3hr": (feed_kghr * gas_pct / 100.0
                               * cfg["lpg_fuel_gas_recovered"]
                               / LPG_LIQUID_DENSITY_KG_M3),
        "yield_sum_wtpct": sum(table.values()),
        "yield_wtpct": table,
    }
    return out


# -- 5.4 ------------------------------------------------------------------
def pct_above_cut_point(curve, cut_point_c):
    """
    Fraction of a stream boiling above the cut point, from its simulated
    distillation curve.  Workbook SimDist column Y.

    `curve` is [(cum_vol_pct, temp_C), ...] ascending. Linear interpolation
    between the two bracketing points; 100 if the whole stream boils above
    the cut, 0 if it all boils below.

    DIAGNOSTIC ONLY. In the workbook this column feeds Sheet1's display
    column J and nothing else - the finished product volumes come from the
    per-stream split table, not from the cut point. It is reported here for
    the same reason: it tells an engineer how well the split assumption
    matches the actual distillation, but it does not drive the slate.
    """
    if not curve:
        return None
    if cut_point_c <= curve[0][1]:
        return 100.0
    if cut_point_c >= curve[-1][1]:
        return 0.0
    for i in range(len(curve) - 1):
        p0, t0 = curve[i]
        p1, t1 = curve[i + 1]
        if t0 <= cut_point_c <= t1:
            span = (t1 - t0)
            frac = 0.0 if span == 0 else (cut_point_c - t0) / span
            return 100.0 - (p0 + frac * (p1 - p0))
    return 0.0


def simdist_stream_feeds(primary_totals, rhc_products):
    """
    Feed volume into each SimDist intermediate stream.  Workbook SimDist
    column C, resolved through the B/D mirror rows.

      diesel  = RHC diesel
      naphtha = primary naphtha + primary AGO + RHC naphtha
      lvgo    = SR LVGO + RHC LVGO
      mvgo    = SR MVGO + RHC MVGO
      hvgo    = SR HVGO only        <- RHC HVGO is flagged "Not to HC"
      srvr    = 0 (no feed in the source case)
      crvr    = 0 (bottoms are not routed back)
    """
    return {
        "srvr":    0.0,
        "diesel":  rhc_products["diesel"],
        "naphtha": (primary_totals["naphtha"] + primary_totals["ago"]
                    + rhc_products["rhc_naphtha"]),
        "lvgo":    primary_totals["lvgo"] + rhc_products["rhc_lvgo"],
        "mvgo":    primary_totals["mvgo"] + rhc_products["rhc_mvgo"],
        "hvgo":    primary_totals["hvgo"],
        "crvr":    0.0,
    }


def simdist_direct_products(stream_feeds, config=None):
    """
    Stage 4 - split each intermediate stream into the seven finished cuts.
    Workbook SimDist volume rows 8/10/12/14/16/18, summed at row 20.

      cut m3/hr = stream feed * split_vol% / 100

    NOTE ON A SOURCE-WORKBOOK DEFECT
    The workbook's SimDist cell AA10 reads `=$C$9*(Z9/100)`. Z9 is the
    Naphtha stream's LPG share (0 %); the intended reference is AA9, its
    naphtha share (37 %). Reading the wrong column drops 88.59 m3/hr of
    naphtha - 16.5 % of everything fed to the SimDist sheet - and that is
    exactly the unexplained gap in the workbook's own volume balance
    (535.64 m3/hr in against 447.05 m3/hr out). Correcting it lifts gross
    margin by about 39 %.

    This engine computes it correctly. The defect is not reproduced. The
    self-test still proves faithfulness to the workbook by checking the six
    unaffected products against it exactly, and by checking that naphtha
    differs from the workbook by exactly the dropped volume and nothing
    else.
    """
    cfg = _merged_config(config)
    splits = cfg["simdist_split_volpct"]

    per_stream, totals = {}, _zero_slate()
    for stream in SIMDIST_STREAMS:
        feed = stream_feeds.get(stream, 0.0)
        table = splits[stream]
        cuts = {p: feed * table.get(p, 0) / 100.0 for p in PRODUCTS}
        per_stream[stream] = cuts
        for p in PRODUCTS:
            totals[p] += cuts[p]
    return {"per_stream": per_stream, "totals_m3hr": totals}


# -- 5.5 ------------------------------------------------------------------
def hcht_split(uco_m3hr, config=None, unit=None):
    """
    Stage 5 - the gas oil conversion unit, on the unconverted oil.
    Workbook SimDist row 22, using the vol % table at row 4.

    The UCO left over from the direct-product split is the feed. It is 99.7 %
    vacuum gas oil, which is why either of two units can take it:

      hydrocracker  Hydrogen addition. Favours kerosene and diesel. The
                    workbook's case, and the only one that ties out.
      fcc           Catalytic cracking. About three times the LPG and half
                    again the naphtha, at the cost of middle distillate. Also
                    makes coke and dry gas, which are not liquid volume and
                    come back under "byproducts".

      cut m3/hr = feed * vol% / 100
    """
    cfg = _merged_config(config)
    unit = unit or cfg["gas_oil_unit"]

    if unit == "fcc":
        table = FCC_GAS_OIL_YIELD_VOLPCT
        out = {p: uco_m3hr * table[p] / 100.0 for p in PRODUCTS}
        feed_kghr = uco_m3hr * FCC_FEED_DENSITY_KG_M3
        out["byproducts"] = {
            "unit": unit, "unit_label": GAS_OIL_UNIT_LABELS[unit],
            "feed_m3hr": uco_m3hr, "feed_kghr": feed_kghr,
            "coke_kghr": feed_kghr * FCC_YIELD_WTPCT["coke"] / 100.0,
            "coke_wtpct": FCC_YIELD_WTPCT["coke"],
            "dry_gas_kghr": feed_kghr * FCC_YIELD_WTPCT["dry_gas"] / 100.0,
            "dry_gas_wtpct": FCC_YIELD_WTPCT["dry_gas"],
            "liquid_volume_yield_volpct": sum(table.values()),
        }
        return out

    if unit != "hydrocracker":
        raise ValueError(f"unknown gas oil unit {unit!r}. Choose one of "
                         f"{tuple(GAS_OIL_UNIT_LABELS)}")

    y = cfg["hcht_yield_volpct"]
    lpg_pct = y["c3"] + y["ic4"] + y["nc4"]
    pct = {
        "lpg":           lpg_pct,
        "naphtha":       y["naphtha"],
        "swing_naphtha": y["swing_naphtha"],
        "kerosene":      y["kerosene"],
        "diesel":        y["diesel"],
        "swing_diesel":  y["swing_diesel"],
        "uco":           y["uco"],
    }
    out = {p: uco_m3hr * pct[p] / 100.0 for p in PRODUCTS}
    out["byproducts"] = {
        "unit": unit, "unit_label": GAS_OIL_UNIT_LABELS[unit],
        "feed_m3hr": uco_m3hr,
        "coke_kghr": 0.0,      # hydrocracking rejects no carbon
        "dry_gas_kghr": 0.0,
        "liquid_volume_yield_volpct": sum(pct.values()),
    }
    return out


def final_product_slate(direct_totals, hc_products, residue_byproducts=None):
    """
    Combine the direct-product and HC-reactor paths.  Workbook SimDist row 24.

    Every cut is direct + HC output, except UCO: the direct UCO was consumed
    as HC feed, so only the HC reactor's own UCO survives.

    The residue unit's recovered LPG is added when residue_byproducts is
    supplied. Omit it and the slate is exactly the workbook's, which is what
    the tie-out test compares against.
    """
    slate = {p: direct_totals[p] + hc_products[p] for p in PRODUCTS}
    slate["uco"] = hc_products["uco"]
    if residue_byproducts:
        slate["lpg"] += residue_byproducts.get("lpg_recovered_m3hr", 0.0)
    return slate


# -- 5.6 ------------------------------------------------------------------
def operating_costs(value, feed_m3hr):
    labels = {"electricity":"Electricity", "steam":"Steam", "naturalGas":"Natural gas", "chemicals":"Chemicals", "maintenance":"Maintenance"}
    if not isinstance(feed_m3hr, (int,float)) or not math.isfinite(feed_m3hr) or feed_m3hr < 0:
        raise ValueError("Feed flow must be finite and nonnegative")
    if value is None:
        value = {key: {"basis":"annual", "consumption":0, "rate":0, "annualCad":0} for key in labels}
    if not isinstance(value, dict) or set(value) != set(labels):
        raise ValueError("Operating costs need all five categories")
    hours = HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR
    items = []
    for key, label in labels.items():
        item = value[key]
        if not isinstance(item, dict) or item.get("basis") not in ("hourly", "throughput", "annual") or any(not isinstance(item.get(k), (int,float)) or not math.isfinite(item[k]) or item[k] < 0 for k in ("consumption", "rate", "annualCad")):
            raise ValueError("Invalid operating cost: " + key)
        if key == "maintenance" and item["basis"] == "hourly":
            raise ValueError("Maintenance uses annual CAD or CAD per m3 feed")
        annual = item["annualCad"] if item["basis"] == "annual" else hours * item["rate"] * (feed_m3hr if key == "maintenance" else item["consumption"] * (feed_m3hr if item["basis"] == "throughput" else 1))
        if not math.isfinite(annual):
            raise ValueError("Operating cost exceeds numeric range")
        items.append({"key":key,"category":label,"annualCad":annual,"cadPerOperatingHour":annual/hours})
    annual = sum(item["annualCad"] for item in items)
    if not math.isfinite(annual):
        raise ValueError("Operating cost exceeds numeric range")
    return {"items":items,"annualCad":annual,"cadPerOperatingHour":annual/hours,"hoursPerYear":hours}


def revenue_opex(percent, legacy, feed, revenue):
    if percent is None and legacy is not None:
        return operating_costs(legacy, feed)
    rate = 8 if percent is None else percent
    if isinstance(rate, bool) or not isinstance(rate, (int,float)) or not math.isfinite(rate) or not 0 <= rate <= 100:
        raise ValueError("OPEX must be between 0 and 100% of sales revenue")
    if not math.isfinite(revenue) or revenue < 0:
        raise ValueError("Sales revenue must be finite and nonnegative")
    hours = HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR
    cost = revenue * rate / 100
    annual = cost * hours
    if not math.isfinite(annual):
        raise ValueError("Operating cost exceeds numeric range")
    return {"items":[{"key":"revenue","category":"Operating allowance","annualCad":annual,"cadPerOperatingHour":cost}],"annualCad":annual,"cadPerOperatingHour":cost,"hoursPerYear":hours}


def economics(crude_flows_m3hr, product_slate_m3hr, config=None,
              market_crude_prices=None, market_product_prices=None):
    """
    Stage 6 - costs, revenue, and gross margin.  Workbook Sheet1 rows 39-55.

      crude cost   = sum(flow * crude price)          C$/hr
      revenue      = sum(product flow * price)        C$/hr
      margin       = revenue - crude cost             C$/hr
      annual       = margin * 24 * 330 / 1e6          million C$/yr

    THREE CASES, and they are not the same kind of thing
      low, high   The workbook's own fixed price assumptions. A cheap-market
                  versus expensive-market range, not a contract-versus-spot
                  split. These two always run and are what the model ties out
                  against, so they never depend on a network call.
      market      Today's estimated prices, from the live pricing layers.
                  Only present when both price sets are supplied, so an
                  offline run simply has no market case rather than a wrong
                  one. This is a THIRD case beside low and high, not a
                  replacement for either: none of the fixed prices is
                  overwritten to produce it.

    Passing only one of the two market price sets is refused. A market margin
    built from live revenue and assumed cost, or the reverse, is not a margin
    of anything - it would silently mix two different worlds and read as a
    real number.
    """
    cfg = _merged_config(config)

    def _crude_cost(prices):
        return sum(crude_flows_m3hr.get(c, 0.0) * prices[c] for c in CRUDES)

    def _revenue(prices):
        return sum(product_slate_m3hr.get(p, 0.0) * prices[p] for p in PRODUCTS)

    cost_low = _crude_cost(cfg["crude_price_low_cad_m3"])
    cost_high = _crude_cost(cfg["crude_price_high_cad_m3"])
    rev_low = _revenue(cfg["product_price_low_cad_m3"])
    rev_high = _revenue(cfg["product_price_high_cad_m3"])
    margin_low = rev_low - cost_low
    margin_high = rev_high - cost_high
    annual = HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR / 1e6

    def cost_for_revenue(r):
        return revenue_opex(cfg.get("opexRevenuePercent"), cfg.get("opex"), sum(crude_flows_m3hr.get(c,0) for c in CRUDES), r)
    opex = cost_for_revenue(rev_low)
    opex_high = cost_for_revenue(rev_high)
    out = {
        "operating_costs": opex,
        "operating_costs_high": opex_high,
        "margin_after_opex_low_mcad_yr": margin_low * annual - opex["annualCad"] / 1e6,
        "margin_after_opex_high_mcad_yr": margin_high * annual - opex_high["annualCad"] / 1e6,
        "crude_cost_low_cad_hr": cost_low,
        "crude_cost_high_cad_hr": cost_high,
        "revenue_low_cad_hr": rev_low,
        "revenue_high_cad_hr": rev_high,
        "margin_low_cad_hr": margin_low,
        "margin_high_cad_hr": margin_high,
        "margin_low_mcad_yr": margin_low * annual,
        "margin_high_mcad_yr": margin_high * annual,
        "market_case": None,
    }

    complete = (market_crude_prices and market_product_prices
                and all(isinstance(market_crude_prices.get(c), (int,float)) and math.isfinite(market_crude_prices[c]) and market_crude_prices[c] >= 0 for c in CRUDES)
                and all(isinstance(market_product_prices.get(p), (int,float)) and math.isfinite(market_product_prices[p]) and market_product_prices[p] >= 0 for p in PRODUCTS))
    if complete:
        cost_market = _crude_cost(market_crude_prices)
        rev_market = _revenue(market_product_prices)
        margin_market = rev_market - cost_market
        opex_market = cost_for_revenue(rev_market)
        out.update({
            "operating_costs_market": opex_market,
            "crude_cost_market_cad_hr": cost_market,
            "revenue_market_cad_hr": rev_market,
            "margin_market_cad_hr": margin_market,
            "margin_market_mcad_yr": margin_market * annual,
            "margin_after_opex_market_mcad_yr": margin_market * annual - opex_market["annualCad"] / 1e6,
            "market_case": "complete",
        })
    elif market_crude_prices or market_product_prices:
        # Partial data. Say so rather than producing a half-live margin.
        missing = []
        if not market_crude_prices:
            missing.append("crude prices")
        else:
            missing += [c for c in CRUDES if market_crude_prices.get(c) is None]
        if not market_product_prices:
            missing.append("product prices")
        else:
            missing += [p for p in PRODUCTS
                        if market_product_prices.get(p) is None]
        out["market_case"] = "incomplete"
        out["market_missing"] = missing

    return out


# =============================================================================
# 6. FULL CHAIN
# =============================================================================

DEFAULT_CRUDE_FLOWS_M3HR = {
    "OSH": 100.0,
    "SHD": 87.0,
    "AWB": 150.0,
    "SCO": 15.0,
    "FRB": 249.66666666666666,
}


def run_workbook_model(crude_flows_m3hr=None, config=None, curves=None,
              market_crude_prices=None, market_product_prices=None,
              residue_unit=None, gas_oil_unit=None):
    """
    Run the whole chain, blend to margin.

    crude_flows_m3hr : per-crude feed rates. Defaults to the workbook case.
    config           : partial config; merged over DEFAULT_CONFIG.
    curves           : optional {stream: [(cum_vol_pct, temp_C), ...]} for the
                       cut-point diagnostic. Omit and the diagnostic is skipped.
    residue_unit     : "lc_finer" or "delayed_coker", on the vacuum residue.
    gas_oil_unit     : "hydrocracker" or "fcc", on the unconverted oil.
                       Both default to the config. Only LC Finer plus
                       hydrocracker is comparable with the workbook.
    market_crude_prices, market_product_prices
                     : optional C$/m3 estimates, which add a third margin case
                       beside low and high. Both are needed or neither is used.
                       Omitting them changes nothing else, so the default run
                       stays offline and ties out to the workbook.

    See run_model_with_market_prices() for the version that fetches these.
    """
    flows = dict(DEFAULT_CRUDE_FLOWS_M3HR if crude_flows_m3hr is None
                 else crude_flows_m3hr)
    cfg = _merged_config(config)

    blend = blend_crudes(flows)
    primary = primary_split(flows, cfg)
    rhc = rhc_split(primary["totals_m3hr"]["vr"], cfg, unit=residue_unit)
    byproducts = rhc["byproducts"]
    feeds = simdist_stream_feeds(primary["totals_m3hr"], rhc)
    direct = simdist_direct_products(feeds, cfg)
    hc = hcht_split(direct["totals_m3hr"]["uco"], cfg, unit=gas_oil_unit)
    gas_oil_byproducts = hc["byproducts"]
    # workbook_slate excludes the residue unit's LPG stream so it stays
    # directly comparable with the spreadsheet; slate includes it.
    workbook_slate = final_product_slate(direct["totals_m3hr"], hc)
    slate = final_product_slate(direct["totals_m3hr"], hc, byproducts)
    econ = economics(flows, slate, cfg,
                     market_crude_prices=market_crude_prices,
                     market_product_prices=market_product_prices)

    cut_diag = None
    if curves:
        cut_diag = {s: pct_above_cut_point(curves.get(s, []), cfg["cut_point_c"])
                    for s in SIMDIST_STREAMS if curves.get(s)}

    return {
        "blend": blend,
        "primary": primary,
        "rhc_products_m3hr": rhc,
        "simdist_stream_feeds_m3hr": feeds,
        "direct_products": direct,
        "hc_reactor_products_m3hr": hc,
        "product_slate_m3hr": slate,
        "workbook_slate_m3hr": workbook_slate,
        "byproducts": byproducts,
        "residue_unit": byproducts["unit"],
        "gas_oil_unit": gas_oil_byproducts["unit"],
        "gas_oil_byproducts": gas_oil_byproducts,
        "economics": econ,
        "cut_point_pct_above": cut_diag,
        "config_used": {"cut_point_c": cfg["cut_point_c"]},
    }


def run_model(crude_flows_m3hr=None, config=None, curves=None,
              market_crude_prices=None, market_product_prices=None,
              residue_unit=None, gas_oil_unit=None):
    """Once-through screening routing. Fixed yields are illustrative, not guarantees.

    Independent residue and gas-oil units accept 'none'. Unconverted residue is
    retained as unpriced inventory. FCC products use disclosed price proxies.
    run_workbook_model preserves the historical workbook calculation for audit.
    """
    from math import isfinite
    flows = dict(DEFAULT_CRUDE_FLOWS_M3HR if crude_flows_m3hr is None else crude_flows_m3hr)
    cfg = _merged_config(config)
    residue_unit = residue_unit or cfg['residue_unit']
    gas_oil_unit = gas_oil_unit or cfg['gas_oil_unit']
    if residue_unit not in RESIDUE_UNIT_LABELS or gas_oil_unit not in GAS_OIL_UNIT_LABELS:
        raise ValueError('Unknown conversion unit')
    if any(not isfinite(v) or v < 0 for v in flows.values()):
        raise ValueError('Feed flows must be finite and nonnegative')
    recovery = cfg['lpg_fuel_gas_recovered']
    if not isfinite(recovery) or not 0 <= recovery <= 1:
        raise ValueError('LPG recovery must be between 0 and 1')
    blend, primary = blend_crudes(flows), primary_split(flows, cfg)
    vr = primary['totals_m3hr']['vr']
    rhc = rhc_split(vr if residue_unit == 'lc_finer' else 0, cfg, unit='lc_finer')
    residue_gas_oil = coker_naphtha = held_residue = 0
    if residue_unit == 'none':
        held_residue = vr
        rhc['byproducts'].update(unit='none', unit_label=RESIDUE_UNIT_LABELS['none'], yield_sum_wtpct=0, yield_wtpct={})
    elif residue_unit == 'delayed_coker':
        ccr = cfg['coker_feed_ccr_wtpct']
        gas, naphtha, coke = 7.8 + .144*ccr, 11.29 + .343*ccr, 1.6*ccr
        gas_oil = 100-gas-naphtha-coke
        if not isfinite(ccr) or ccr < 0 or gas_oil < 0:
            raise ValueError('Coker CCR produces invalid yields')
        mass = vr * RHC_FEED_DENSITY_KG_M3
        factor = mass / RHC_PRODUCT_DENSITY_KG_M3 / 100
        residue_gas_oil, coker_naphtha = factor*gas_oil, factor*naphtha
        rhc['rhc_naphtha'], rhc['gas_oil_pool'] = coker_naphtha, residue_gas_oil
        rhc['byproducts'].update(unit=residue_unit, unit_label=RESIDUE_UNIT_LABELS[residue_unit],
            feed_m3hr=vr, feed_kghr=mass, coke_kghr=mass*coke/100, coke_wtpct=coke,
            lpg_fuel_gas_kghr=mass*gas/100, lpg_fuel_gas_wtpct=gas,
            lpg_recovered_m3hr=mass*gas/100*recovery/LPG_LIQUID_DENSITY_KG_M3,
            yield_sum_wtpct=100, yield_wtpct=dict(naphtha=naphtha,gas_oil_pool=gas_oil,lpg_fuel_gas=gas,coke=coke))
    else:
        residue_gas_oil = sum(rhc[k] for k in ['rhc_lvgo','rhc_mvgo','rhc_hvgo'])
        held_residue = rhc['unconverted_residue']
    feeds = dict(srvr=0,crvr=0,lvgo=0,mvgo=0,hvgo=0,
        naphtha=primary['totals_m3hr']['naphtha']+primary['totals_m3hr']['ago']+(rhc['rhc_naphtha'] if residue_unit=='lc_finer' else 0),
        diesel=rhc['diesel'] if residue_unit=='lc_finer' else 0)
    direct = simdist_direct_products(feeds,cfg)
    direct['totals_m3hr']['naphtha'] += coker_naphtha
    direct['per_stream']['coker_naphtha'] = {**dict.fromkeys(PRODUCTS,0), 'naphtha':coker_naphtha}
    straight_vgo, heavy_tail = primary['totals_m3hr']['vgo'], direct['totals_m3hr']['uco']
    pool = straight_vgo+residue_gas_oil+heavy_tail
    pool_mass = straight_vgo*FCC_FEED_DENSITY_KG_M3+(residue_gas_oil+heavy_tail)*RHC_PRODUCT_DENSITY_KG_M3
    if gas_oil_unit == 'none':
        hc = {**dict.fromkeys(PRODUCTS,0), 'uco':pool, 'byproducts':dict(unit='none',unit_label=GAS_OIL_UNIT_LABELS['none'],feed_m3hr=0,feed_kghr=0,coke_kghr=0,dry_gas_kghr=0,liquid_volume_yield_volpct=0)}
    elif gas_oil_unit == 'fcc':
        ref = GRACE_FCC_REFERENCE
        y = ref['yield_wtpct']
        def vol(p): return pool_mass*y[p]/100/GRACE_FCC_DENSITY_KG_M3[p]
        native = {p:vol(p) for p in GRACE_FCC_DENSITY_KG_M3}
        hc = {**dict.fromkeys(PRODUCTS,0), 'lpg':native['lpg'],'naphtha':native['gasoline'],'diesel':native['lco'],'uco':native['bottoms']}
        hc['byproducts'] = dict(unit='fcc',unit_label=GAS_OIL_UNIT_LABELS['fcc'],feed_m3hr=pool,feed_kghr=pool_mass,
            coke_kghr=pool_mass*y['coke']/100,coke_wtpct=y['coke'],dry_gas_kghr=pool_mass*y['dry_gas']/100,dry_gas_wtpct=y['dry_gas'],
            liquid_volume_yield_volpct=sum(hc.values())/pool*100 if pool else 0,source=ref['source'],source_url=ref['url'],
            conversion_wtpct=ref['conversion_wtpct'],yield_wtpct=dict(y),unallocated_wtpct=ref['unallocated_wtpct'],
            unallocated_kghr=pool_mass*ref['unallocated_wtpct']/100,native_products_m3hr=native)
    else:
        hc = hcht_split(pool,cfg,unit='hydrocracker')
    workbook_slate = final_product_slate(direct['totals_m3hr'],hc)
    slate = final_product_slate(direct['totals_m3hr'],hc,rhc['byproducts'])
    destination = 'Held gas oil (UCO price proxy)' if gas_oil_unit=='none' else GAS_OIL_UNIT_LABELS[gas_oil_unit]
    def route(stream,destination,flow,mass):
        return dict(stream=stream,destination=destination,flow_m3hr=flow,mass_kghr=mass)
    return dict(cut_point_pct_above={s: pct_above_cut_point(curves.get(s, []), cfg["cut_point_c"]) for s in SIMDIST_STREAMS if curves.get(s)} if curves else None,
        config_used={"cut_point_c":cfg["cut_point_c"]},blend=blend,primary=primary,rhc_products_m3hr=rhc,simdist_stream_feeds_m3hr=feeds,direct_products=direct,
        hc_reactor_products_m3hr=hc,product_slate_m3hr=slate,workbook_slate_m3hr=workbook_slate,byproducts=rhc['byproducts'],
        residue_unit=residue_unit,gas_oil_unit=gas_oil_unit,gas_oil_byproducts=hc['byproducts'],
        economics=economics(flows,slate,cfg,market_crude_prices=market_crude_prices,market_product_prices=market_product_prices),
        unpriced_residue_m3hr=held_residue,routing_basis='Illustrative once-through feed-specific routing; fixed yield and density assumptions',
        routing=[route('Primary vacuum residue','Held residue (unpriced)' if residue_unit=='none' else RESIDUE_UNIT_LABELS[residue_unit],vr,vr*RHC_FEED_DENSITY_KG_M3),
            route('Straight-run VGO',destination,straight_vgo,straight_vgo*FCC_FEED_DENSITY_KG_M3),
            route('Coker gas-oil pool (cut split unknown)' if residue_unit=='delayed_coker' else 'LC Finer gas-oil fractions',destination,residue_gas_oil,residue_gas_oil*RHC_PRODUCT_DENSITY_KG_M3),
            route('Distillate heavy tail',destination,heavy_tail,heavy_tail*RHC_PRODUCT_DENSITY_KG_M3),
            route('Terminal residue inventory','Held residue (unpriced)',held_residue,held_residue*(RHC_FEED_DENSITY_KG_M3 if residue_unit=='none' else RHC_PRODUCT_DENSITY_KG_M3))])


from common import execute, cli, epoch

def calculate(rows,config,parameters):
    """Compute scenario rates/annual values, or integrate explicit historical intervals.

    Flows m3/h; prices CAD/m3; OPEX percentage of revenue or legacy item basis.
    intervalEnd enables time integration at the website's 330/365 availability.
    Rates, annual scenario values and integrated period totals are kept separate.
    """
    output=[]
    for i,row in enumerate(rows):
        if row.get('intervalEnd') and i+1<len(rows) and epoch(row['intervalEnd'])>epoch(rows[i+1]['timestamp']):raise ValueError('Historical intervals must not overlap')
        market=row.get('market') or {}
        result=run_model(row.get('flows'),config,market_crude_prices=market.get('crude'),market_product_prices=market.get('product'),residue_unit=parameters.get('residueUnit','lc_finer'),gas_oil_unit=parameters.get('gasOilUnit','hydrocracker'))
        result['economics'].pop('market_missing',None)
        result['economics']['has_market_case']=result['economics'].pop('market_case')=='complete'
        result.pop('config_used',None); result.pop('cut_point_pct_above',None)
        result['timestamp']=row['timestamp']
        if row.get('intervalEnd'):
            start,end=epoch(row['timestamp']),epoch(row['intervalEnd'])
            if end<=start: raise ValueError('intervalEnd must be later than timestamp')
            window=parameters.get('integrationWindow')
            if window:
                if epoch(window['start'])>epoch(window['end']):raise ValueError('Integration window start must not exceed end')
                start,end=max(start,epoch(window['start'])),min(end,epoch(window['end']))
            hours=max(0,end-start)/3600000*330/365
            e=result['economics'];case=parameters.get('priceCase','market')
            if case not in ('low','high','market'):raise ValueError('Unsupported priceCase')
            revenue=e[f'revenue_{case}_cad_hr'];feed=e[f'crude_cost_{case}_cad_hr'];opex=e['operating_costs' if case=='low' else f'operating_costs_{case}']
            if revenue is None or feed is None or opex is None:raise ValueError('Complete prices required for interval integration')
            result['period']={'operatingHours':hours,'revenueCad':revenue*hours,'feedCostCad':feed*hours,'opexCad':opex['cadPerOperatingHour']*hours,'marginCad':(revenue-feed-opex['cadPerOperatingHour'])*hours}
        output.append(result)
    return output

def run(payload):return execute(payload,'crude-to-profit',calculate)
if __name__=='__main__':cli(run)
