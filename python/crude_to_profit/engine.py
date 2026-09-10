"""
Crude to Profit - Refinery Blend Costing & Margin Engine
Version: 3.0
Date: 2026-09-10

Offline screening engine matching the React routing model. Independent residue
and gas-oil conversion choices; fixed illustrative yield tables. Low/High
prices and 24 x 330 annualization follow the client workbook. Live prices are
optional explicit inputs. Unconverted residue is unpriced inventory.

run_workbook_model retains the historical calculation, including correction
of SimDist AA10. Its tie-out does not describe the current routed volumes.
Read CRUDE-WORKBOOK-AUDIT.md for assumptions and exclusions.
Optional pricing functions use public Alberta, EIA and Bank of Canada data.
Credentials must stay out of published files.

Usage:
    from engine import run_model, DEFAULT_CONFIG
    result = run_model()
    print(result["economics"]["margin_low_cad_hr"])
"""

import csv
import json
import os
import urllib.error
import urllib.parse
import urllib.request

# =============================================================================
# 1. CONFIGURATION  (swappable per refinery type)
# =============================================================================
# Yield data changes with the refinery. All four yield tables live here so a
# caller can pass a different config and get correct results. Defaults are the
# exact values in the source workbook.

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

# Published FCC yields, wt% of gas oil feed at about 70 % conversion. Every
# value sits inside its published range and the set sums to exactly 100.
FCC_YIELD_WTPCT = {
    "dry_gas":   4.0,    # published 2-7
    "lpg":      12.0,    # published 10-15
    "gasoline": 47.0,    # published 45-55
    "lco":      21.0,    # published 20-25, light cycle oil
    "slurry":   10.0,    # published 8-12, heavy cycle oil / decant
    "coke":      6.0,    # published 5-7
}

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


# =============================================================================
# 3. INTEGRATION HOOK  (for the live-data implementer)
# =============================================================================
# Every fetch below returns a plain dict and NEVER raises. If the network is
# down, a key is missing, or the payload shape changes, the function returns
# {"ok": False, "value": <manual fallback or None>, "source": "manual"|"unavailable"}.
# The calculation chain must keep working with no external access at all, so
# nothing downstream may depend on a live call succeeding.
#
# Prices are quoted natively (USD/bbl, USD/gal). The calc chain works in
# C$/m3. Conversion is explicit and needs an FX rate the caller supplies -
# no exchange rate is assumed or hardcoded here. See to_cad_per_m3().
#
# Required environment variables (never hardcode a key):
#   EIA_API_KEY              https://www.eia.gov/opendata/register.php
# CrudeMonitor and Alberta Economic Data need no key. Nothing here is paid.
#
# WCS freshness
# -------------
# Alberta publishes WCS monthly and runs about two months behind. EIA
# publishes WTI daily. The WCS-WTI differential is the Canadian-specific
# part and it moves slowly (structural: pipeline capacity and crude
# quality), while the outright price tracks WTI. So the daily WCS estimate
# is built as:
#
#     WCS = WTI (EIA, daily) - differential (Alberta, monthly)
#
# Verified against Alberta's own published series: their differential is
# exactly WTI - WCS to the cent, every month checked. fetch_wcs_usd_bbl()
# returns this estimate when both feeds answer, falls back to Alberta's
# published monthly WCS otherwise, and reports which path it took plus the
# vintage of the differential so a caller can show the data age.
# =============================================================================

_HTTP_TIMEOUT_S = 10

# Some public endpoints (Alberta's economic data service among them) reject
# requests that arrive with no User-Agent, so send one on every call.
_HTTP_HEADERS = {"User-Agent": "Ferriq-CrudeToProfit/1.0"}

# Local secrets file, sitting beside this module. Keys go here rather than
# in the source, because this model ships in a public repository that
# deploys to GitHub Pages - anything committed is world-readable and gets
# scraped. secrets.local.py is listed in .gitignore and never committed.
#
#   secrets.local.py
#   ----------------
#   EIA_API_KEY = "your-key"
#   CRUDEMONITOR_URL = "https://..."   # optional
#
# Environment variables still win if set, so CI and servers can inject
# their own without touching the file.
_SECRETS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "secrets.local.py")
_secrets_cache = None


def _load_secrets():
    """Read secrets.local.py once. Missing or unreadable file is not an error."""
    global _secrets_cache
    if _secrets_cache is None:
        _secrets_cache = {}
        try:
            with open(_SECRETS_FILE, "r", encoding="utf-8") as f:
                for raw in f:
                    line = raw.split("#", 1)[0].strip()
                    if "=" not in line:
                        continue
                    name, _, value = line.partition("=")
                    _secrets_cache[name.strip()] = value.strip().strip("\"'")
        except OSError:
            pass
    return _secrets_cache


def get_secret(name):
    """Environment first, then secrets.local.py, then None."""
    return os.environ.get(name) or _load_secrets().get(name) or None

# EIA spot-price series IDs, taken from EIA's published spot-price tables
# (eia.gov/dnav/pet/pet_pri_spt_s1_d.htm), not guessed.
EIA_SERIES = {
    "wti_usd_bbl":      "RWTC",                       # WTI, Cushing
    "brent_usd_bbl":    "RBRTE",                      # Brent
    "ulsd_gc_usd_gal":  "EER_EPD2DXL0_PF4_RGC_DPG",   # ULSD, Gulf Coast
    "ulsd_nyh_usd_gal": "EER_EPD2DXL0_PF4_Y35NY_DPG", # ULSD, New York Harbor
    "propane_usd_gal":  "EER_EPLLPA_PF4_Y44MB_DPG",   # Propane, Mont Belvieu
    "gasoline_usd_gal": "EER_EPMRU_PF4_RGC_DPG",      # Conventional gasoline
    "jetfuel_usd_gal":  "EER_EPJK_PF4_RGC_DPG",       # Kerosene-type jet fuel
}

# Which EIA series are quoted per gallon rather than per barrel.
EIA_UNITS = {k: ("usd_bbl" if k.endswith("_bbl") else "usd_gal")
             for k in EIA_SERIES}

ALBERTA_OIL_PRICES_URL = ("https://api.economicdata.alberta.ca/data"
                          "?table=OilPrices")


def _http_get_json(url, headers=None, timeout=_HTTP_TIMEOUT_S):
    """GET a URL and parse JSON. Returns None on any failure - never raises."""
    merged = dict(_HTTP_HEADERS)
    merged.update(headers or {})
    req = urllib.request.Request(url, headers=merged)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError,
            TimeoutError, OSError):
        return None


def _result(value, ok, source, detail=None):
    out = {"ok": ok, "value": value, "source": source}
    if detail:
        out["detail"] = detail
    return out


def fetch_crude_assay(crude, manual=None, url=None):
    """
    Crude quality and simulated-distillation data from CrudeMonitor.ca.

    SETUP REQUIRED - this is the one source that will not self-configure.
    CrudeMonitor does not expose a plain documented GET endpoint. Its API
    page is a form that POSTs to an internal url.php and hands back a
    generated data URL, and that generator rejects programmatic POSTs
    (verified: urlencoded and multipart both 400). So the URL has to be
    produced once, by hand:

        1. Open https://www.crudemonitor.ca/api/1.1/api.php
        2. Tick the streams you want (OSH, SHD, AWB, OSA, FRB) and the
           properties (crudes-BA for basic analysis, crudes-HTSD for
           simulated distillation, crudes-LE for light ends)
        3. Click generate, copy the URL it returns
        4. Pass it here as `url`, or set CRUDEMONITOR_URL in the environment

    Without that URL this function returns the built-in CRUDE_PROPERTIES and
    reports source="builtin", which is a correct and safe result: density and
    sulfur are fixed constants anyway (section 2), and the distillation
    curves only feed the cut-point diagnostic, which does not drive the
    product slate. Nothing in the margin calculation depends on this call.
    """
    code = CRUDEMONITOR_CODES.get(crude, crude)
    endpoint = url or get_secret("CRUDEMONITOR_URL")
    if endpoint:
        payload = _http_get_json(endpoint)
        if payload:
            return _result(payload, True, "crudemonitor", detail=code)
    if manual is not None:
        return _result(manual, False, "manual", detail=code)
    return _result(CRUDE_PROPERTIES.get(crude), False, "builtin", detail=code)


def _first_eia_row(payload):
    """Pull the most recent (value, period) out of an EIA v2 response."""
    try:
        row = payload["response"]["data"][0]
        return float(row["value"]), row.get("period")
    except (KeyError, IndexError, TypeError, ValueError):
        return None, None


def fetch_eia_spot(series, manual=None):
    """
    Latest daily spot price for one EIA series, in its native unit.

    `series` is a key of EIA_SERIES (for example "wti_usd_bbl") or a raw
    EIA series ID. Needs EIA_API_KEY. Returns the standard result dict and
    carries the observation date in `detail`.
    """
    series_id = EIA_SERIES.get(series, series)
    key = get_secret("EIA_API_KEY")
    if key:
        url = ("https://api.eia.gov/v2/petroleum/pri/spt/data/?"
               + urllib.parse.urlencode({
                   "api_key": key, "frequency": "daily",
                   "data[0]": "value", "facets[series][]": series_id,
                   "sort[0][column]": "period", "sort[0][direction]": "desc",
                   "length": "1"}))
        value, period = _first_eia_row(_http_get_json(url))
        if value is not None:
            return _result(value, True, "eia", detail=period)
    if manual is not None:
        return _result(float(manual), False, "manual", detail=series_id)
    return _result(None, False, "unavailable", detail=series_id)


def fetch_wti_usd_bbl(manual=None):
    """WTI Cushing spot, USD/bbl, daily, from EIA."""
    return fetch_eia_spot("wti_usd_bbl", manual)


def fetch_ulsd_usd_gal(manual=None):
    """
    ULSD (ultra-low-sulfur No. 2 diesel) spot, USD/gal, daily, from EIA.

    APPROXIMATION. EIA publishes this for the US Gulf Coast and New York
    Harbor. For a Western Canadian refinery the geographically correct benchmark is
    Chicago / Midwest, which EIA releases only as a weekly spreadsheet, and
    the Canadian side is NRCan's weekly wholesale series, which has no API.
    Treat this as an indicative diesel price, not the realised netback.
    """
    return fetch_eia_spot("ulsd_gc_usd_gal", manual)


def fetch_alberta_oil_prices(manual=None):
    """
    Monthly WTI, WCS, and the WCS-WTI differential from the Government of
    Alberta's economic data service. Free, no key, USD/bbl.

    Returns the latest non-null observation for each series as
    {"WTI": (value, date), "WCS": (...), "Differential": (...)}.

    Monthly and roughly two months in arrears. Use it for the differential
    and as the authoritative WCS cross-check; use EIA for a daily WTI.
    """
    payload = _http_get_json(ALBERTA_OIL_PRICES_URL)
    if isinstance(payload, list) and payload:
        latest = {}
        for rec in payload:
            # NB: the upstream key really does carry a trailing space.
            kind = (rec.get("Type ") or rec.get("Type") or "").strip()
            value, date = rec.get("Value"), (rec.get("Date") or "")[:10]
            if kind and value is not None:
                if kind not in latest or date > latest[kind][1]:
                    latest[kind] = (float(value), date)
        if latest:
            return _result(latest, True, "alberta")
    if manual is not None:
        return _result(manual, False, "manual")
    return _result(None, False, "unavailable")


def fetch_wcs_usd_bbl(manual=None, wti_manual=None):
    """
    Western Canadian Select at Hardisty, USD/bbl.

    Preferred path is a daily estimate: EIA's daily WTI minus Alberta's
    published WCS-WTI differential. Falls back to Alberta's own monthly WCS,
    then to `manual`. `detail` records which path ran and the vintage of
    each input so a caller can display the data age honestly.
    """
    alberta = fetch_alberta_oil_prices()
    wti = fetch_wti_usd_bbl(wti_manual)

    if alberta["ok"] and "Differential" in alberta["value"]:
        diff, diff_date = alberta["value"]["Differential"]
        if wti["value"] is not None:
            # Name the WTI leg by where it actually came from. Calling this
            # "eia+alberta" when the WTI was a manual stand-in would let a
            # dashboard show live provenance for a number nobody fetched.
            label = f"{wti['source']}+alberta"
            return _result(wti["value"] - diff, wti["ok"], label,
                           detail={"method": "wti_minus_differential",
                                   "wti": wti["value"],
                                   "wti_detail": wti.get("detail"),
                                   "wti_source": wti["source"],
                                   "differential": diff,
                                   "differential_date": diff_date})
        if "WCS" in alberta["value"]:
            wcs, wcs_date = alberta["value"]["WCS"]
            return _result(wcs, True, "alberta",
                           detail={"method": "alberta_monthly_wcs",
                                   "wcs_date": wcs_date})
    if manual is not None:
        return _result(float(manual), False, "manual")
    return _result(None, False, "unavailable")


def live_product_prices_cad_m3(usd_cad_fx, config=None, manual=None):
    """
    Build C$/m3 prices for the products that have a public benchmark, using
    the same benchmark-plus-differential pattern as the crudes.

    LPG prices off propane, naphtha off conventional gasoline, kerosene off
    jet fuel, diesel off ULSD. Swing naphtha, swing diesel, and UCO come back
    None here.

    SUPERSEDED by product_market_values_cad_m3(), which values all seven,
    including the swing cuts, and carries provenance and freshness per
    product. Kept because it still works and callers may depend on it.
    """
    cfg = _merged_config(config)
    manual = manual or {}
    prices, meta = {}, {}
    for product in PRODUCTS:
        series = cfg["product_benchmark"].get(product)
        if not series:
            prices[product] = None
            continue
        res = fetch_eia_spot(series, manual.get(product))
        meta[product] = res
        native = to_cad_per_m3(res["value"], EIA_UNITS.get(series, "usd_gal"),
                               usd_cad_fx)
        diff = cfg["product_differential_cad_m3"].get(product, 0.0)
        prices[product] = None if native is None else native + diff
    return prices, meta


def product_market_values_cad_m3(usd_cad_fx, wti_manual=None,
                                 differential_manual=None, previous=None,
                                 alberta_ngl_manual=None):
    """
    Estimated refinery-gate market values for the seven products, C$/m3, via
    product_pricing.py. Returns (prices, meta).

    LPG and naphtha anchor on the Government of Alberta NGL reference prices
    and move daily with EIA. Kerosene and diesel carry a direct EIA benchmark
    (jet fuel and ULSD). The three swing and residual cuts have no traded
    benchmark and are valued from their destinations, which is a modelling
    choice rather than missing data.

    These are bulk market values at the refinery gate. No retail series is
    used and no consumer tax or retail margin is included.
    """
    import alberta_ngl_pricing as ang
    import product_pricing as pp

    benchmarks = {}
    for series in ("propane_usd_gal", "gasoline_usd_gal", "jetfuel_usd_gal",
                   "ulsd_gc_usd_gal", "ulsd_nyh_usd_gal"):
        row = fetch_eia_spot(series)
        benchmarks[series] = {"value": row["value"],
                              "unit": EIA_UNITS.get(series, "usd_gal"),
                              "date": row.get("detail")}

    wcs = fetch_wcs_usd_bbl(wti_manual=wti_manual, manual=differential_manual)
    benchmarks["wcs_date"] = (wcs.get("detail", {}) or {}).get("differential_date") \
        if isinstance(wcs.get("detail"), dict) else None

    # LPG and naphtha anchor on the Government of Alberta NGL reference
    # prices. The anchor lags about two months, so it is rolled forward to
    # today by the daily EIA benchmarks already fetched above. If either leg
    # is missing, product_pricing falls back to the old EIA proxy and labels
    # it as a proxy rather than reporting an anchor it did not have.
    ngl = None
    alberta_ngl = ang.fetch_alberta_ngl_prices(manual=alberta_ngl_manual)
    anchor_month = (alberta_ngl.get("detail") or {}).get("anchor_month")
    if alberta_ngl["value"] and anchor_month:
        drivers = ang.fetch_drivers(anchor_month, get_secret("EIA_API_KEY"))
        today = {k: (benchmarks.get(k, {}) or {}).get("value")
                 or drivers["today"].get(k)
                 for k in drivers["today"]}
        ngl = ang.build_ngl_prices(alberta_ngl["value"],
                                   drivers["month_averages"], today)

    prices = pp.estimate_product_prices(
        benchmarks, usd_cad=usd_cad_fx, wcs_usd_bbl=wcs["value"],
        previous=previous, ngl=ngl)
    return ({p: prices[p]["price_cad_m3"] for p in PRODUCTS},
            {"detail": prices, "wcs_usd_bbl": wcs["value"],
             "wcs_source": wcs["source"],
             "alberta_ngl": {"ok": alberta_ngl["ok"],
                             "source": alberta_ngl["source"],
                             "anchor_month": anchor_month,
                             "values": alberta_ngl["value"]}})


def canadian_crude_prices_cad_m3(usd_cad_fx, wti_manual=None,
                                 differential_manual=None, config=None):
    """
    Estimated C$/m3 acquisition prices for the five Canadian crude feeds,
    via the two-stage Canadian pricing layer in canadian_crude_pricing.py:

        WCS  = EIA daily WTI + Alberta WCS-WTI differential (signed)
        feed = WCS + configured grade differential
        C$/m3 = USD/bbl * USD/CAD * bbl per m3

    Returns (prices, meta). `meta` carries the derived WCS, the vintage of
    each input, and per-feed provenance including the confidence of each
    grade mapping, so a caller can show which prices are exact and which are
    proxies. Every value is a model-derived estimate, not a market
    assessment.

    Grade differentials are configured in canadian_crude_pricing, not here.
    That module is the only place they should be edited.
    """
    import canadian_crude_pricing as ccp

    est = ccp.estimate_from_live_sources(usd_cad=usd_cad_fx,
                                         wti_manual=wti_manual,
                                         differential_manual=differential_manual,
                                         config=config)
    if not est.get("ok"):
        return ({c: None for c in CRUDES}, est)

    prices = {c: est["feeds_cad_m3"].get(c) for c in CRUDES}
    # The workbook calls Suncor Synthetic A "SCO"; the pricing layer keys it
    # by its CrudeMonitor code OSA.
    if prices.get("SCO") is None:
        prices["SCO"] = est["feeds_cad_m3"].get("OSA")
    meta = {k: est[k] for k in ("wcs_usd_bbl", "wti_usd_bbl", "wti_source",
                                "wti_date", "wcs_wti_differential",
                                "differential_source", "differential_date",
                                "feeds_usd_bbl", "provenance", "is_estimate")}
    return prices, meta


def to_cad_per_m3(value, unit, usd_cad_fx):
    """
    Convert a quoted price to C$/m3. The caller supplies the USD/CAD rate;
    this module never assumes one.
      unit: "usd_bbl" | "usd_gal"
    """
    if value is None or usd_cad_fx is None:
        return None
    if unit == "usd_bbl":
        return float(value) * M3_TO_BBL * float(usd_cad_fx)
    if unit == "usd_gal":
        return float(value) * 264.172052 * float(usd_cad_fx)
    raise ValueError(f"unknown unit: {unit}")


def live_crude_prices_cad_m3(usd_cad_fx, config=None, wti_manual=None,
                             wcs_manual=None):
    """
    Build a per-crude C$/m3 price from the two live benchmarks plus each
    crude's configured differential. Returns (prices, meta). Any crude whose
    benchmark is unavailable comes back as None so the caller can fall back
    to the fixed reference price.

    SUPERSEDED by canadian_crude_prices_cad_m3(), which prices all five feeds
    off a single derived WCS using named grade differentials in USD/bbl and
    carries per-feed provenance. Kept because it still works and callers may
    depend on it. Prefer the newer function for anything user-facing.
    """
    cfg = _merged_config(config)
    wti = fetch_wti_usd_bbl(wti_manual)
    wcs = fetch_wcs_usd_bbl(wcs_manual)
    base = {
        "WTI": to_cad_per_m3(wti["value"], "usd_bbl", usd_cad_fx),
        "WCS": to_cad_per_m3(wcs["value"], "usd_bbl", usd_cad_fx),
    }
    prices = {}
    for crude in CRUDES:
        mark = cfg["crude_benchmark"][crude]
        anchor = base.get(mark)
        diff = cfg["crude_differential_cad_m3"].get(crude, 0.0)
        prices[crude] = None if anchor is None else anchor + diff
    return prices, {"wti": wti, "wcs": wcs, "benchmark_cad_m3": base}


# =============================================================================
# 4. HELPERS
# =============================================================================

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

    out = {
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
                and all(market_crude_prices.get(c) is not None for c in CRUDES)
                and all(market_product_prices.get(p) is not None for p in PRODUCTS))
    if complete:
        cost_market = _crude_cost(market_crude_prices)
        rev_market = _revenue(market_product_prices)
        margin_market = rev_market - cost_market
        out.update({
            "crude_cost_market_cad_hr": cost_market,
            "revenue_market_cad_hr": rev_market,
            "margin_market_cad_hr": margin_market,
            "margin_market_mcad_yr": margin_market * annual,
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
        def vol(p): return pool_mass*FCC_YIELD_WTPCT[p]/100/FCC_PRODUCT_DENSITY_KG_M3[p]
        hc = {**dict.fromkeys(PRODUCTS,0), 'lpg':vol('lpg'),'naphtha':vol('gasoline'),'uco':vol('lco')+vol('slurry')}
        hc['byproducts'] = dict(unit='fcc',unit_label=GAS_OIL_UNIT_LABELS['fcc'],feed_m3hr=pool,feed_kghr=pool_mass,coke_kghr=pool_mass*.06,coke_wtpct=6,dry_gas_kghr=pool_mass*.04,dry_gas_wtpct=4,liquid_volume_yield_volpct=sum(hc.values())/pool*100 if pool else 0)
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


# Used when no exchange rate is supplied. A fallback, not a live rate: pass
# usd_cad_fx explicitly for anything that matters.
DEFAULT_USD_CAD = 1.37


def run_model_with_market_prices(crude_flows_m3hr=None, config=None,
                                 curves=None, usd_cad_fx=None):
    """
    run_model() plus a third margin case built from today's estimated prices.

    Fetches both price sets, then runs the model once with all three cases.
    Returns (result, price_meta) so a caller can see where each price came
    from and how fresh it is, not just the margin it produced.

    If either fetch is incomplete the model still runs and still ties out;
    economics()["market_case"] just reports "incomplete" and names what was
    missing. The low and high cases are never affected by any of this.
    """
    fx = usd_cad_fx if usd_cad_fx is not None else DEFAULT_USD_CAD
    crude_prices, crude_meta = canadian_crude_prices_cad_m3(fx)
    product_prices, product_meta = product_market_values_cad_m3(fx)
    result = run_model(crude_flows_m3hr, config, curves,
                      market_crude_prices=crude_prices,
                      market_product_prices=product_prices)
    return result, {"usd_cad": fx, "crude": crude_meta, "product": product_meta,
                    "crude_prices_cad_m3": crude_prices,
                    "product_prices_cad_m3": product_prices}


# =============================================================================
# 7. SELF-TEST
# =============================================================================

if __name__ == "__main__":
    import json
    result = run_model()
    print(json.dumps({k:result[k] for k in ['residue_unit','gas_oil_unit','routing','unpriced_residue_m3hr','economics']}, indent=2))
    print('Illustrative routing. Annual figures use 24 x 330 hours. Run npm run test:python for parity and historical workbook checks.')
