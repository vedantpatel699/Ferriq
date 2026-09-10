"""
Refinery Product Market-Value Layer
Version: 2.0
Date: 2026-08-25

Estimates what the seven finished products are worth leaving the refinery gate,
in C$/m3, for the revenue side of the margin calculation.

ACCOUNTING BOUNDARY
    These are bulk market values, not pump prices. Nothing here includes
    consumer fuel taxes, retail markup, retailer operating margin, or delivery
    charges. The model represents the economics of the refinery, not of the
    fuel-retail chain. EIA's retail series (pri/gnd) are deliberately not used.

FOUR KINDS OF PRICE
    direct_market_benchmark   the product has a real traded benchmark
                              kerosene, diesel
    regional_anchor           an official Alberta price for this month, moved
                              day to day by a US benchmark. LPG, naphtha
    market_proxy              priced off a related but different commodity.
                              Now only a fallback when the anchor is missing
    opportunity_value         no external price; worth what its destination
                              is worth. swing naphtha, swing diesel, UCO

WHY LPG AND NAPHTHA CHANGED IN v2
    They used to price off finished gasoline and pure propane. Finished
    gasoline is a spec consumer fuel and naphtha is a blendstock feeding into
    it, so that overstated naphtha by roughly 70 percent. Both now anchor on
    the Government of Alberta NGL reference prices, which are Alberta prices
    published in C$/m3, and move daily with a US benchmark. See
    alberta_ngl_pricing.py.

Swing cuts are NOT missing data. A swing cut's value genuinely depends on
which pool it is sent to, so it is calculated from its destinations rather
than looked up. Label them "model-derived", never "no public benchmark".

GEOGRAPHIC LIMITATION
    EIA benchmarks are US market prices and this refinery is in Western
    Canada, so there is real basis risk. Every product carries a
    basis_cad_m3, all set to zero. Leave them at zero until there is
    defensible historical data; do not invent a basis. The two Alberta
    anchored products carry their regional basis inside the anchor already.

THE CLIENT RANGE IS A COMPARISON, NOT A TARGET
    CLIENT_REFERENCE_RANGE holds the fixed prices the source workbook
    assumes. It is reported beside the market estimate and never constrains
    it. Do not calibrate any factor to land inside it. An estimate that
    disagrees with the assumption IS the finding; hiding the disagreement
    removes the only reason to compute a market value at all.

Usage:
    from product_pricing import estimate_product_prices
    prices = estimate_product_prices(benchmarks, usd_cad=1.37, wcs_usd_bbl=73.2)
"""

from datetime import date, datetime

PRODUCTS = ("lpg", "naphtha", "swing_naphtha", "kerosene",
            "diesel", "swing_diesel", "uco")


# =============================================================================
# 1. CENTRAL PRICING CONFIGURATION
# =============================================================================
# The only place product-to-benchmark mappings should live. Benchmark keys are
# the project's existing EIA series keys (engine.EIA_SERIES), not new ones.

PRODUCT_PRICING = {
    "lpg": {
        "pricing_mode": "regional_anchor",
        "source": "Government of Alberta + EIA",
        "anchor_label": "Alberta Propane Spec and Butanes Spec",
        "benchmark": "propane_usd_gal",          # fallback proxy only
        "benchmark_label": "EIA Mont Belvieu propane",
        "ui_label": "Alberta NGL reference price, moved daily",
        "confidence": "medium",
        "basis_cad_m3": 0.0,
        "note": "The LPG stream is C3 + iC4 + nC4, so it is valued as a "
                "volume-weighted blend of Alberta's propane and butanes "
                "reference prices rather than as pure propane. Alberta does "
                "not price iC4 and nC4 separately, so both sit inside the "
                "butanes line. Butane has no EIA daily series, so gasoline "
                "supplies its daily movement; that is the weakest link here.",
    },
    "naphtha": {
        "pricing_mode": "regional_anchor",
        "source": "Government of Alberta + EIA",
        "anchor_label": "Alberta Pentanes Plus Spec",
        "benchmark": "gasoline_usd_gal",         # fallback proxy only
        "benchmark_label": "EIA Gulf Coast conventional gasoline",
        "ui_label": "Alberta NGL reference price, moved daily",
        "confidence": "medium",
        "basis_cad_m3": 0.0,
        "note": "Naphtha is a gasoline blendstock, not finished gasoline, and "
                "trades below it. Anchored on Alberta's pentanes plus "
                "reference price, which is a light-hydrocarbon price for this "
                "province in the right currency and unit. Pentanes plus is "
                "condensate rather than a refinery naphtha cut, so it remains "
                "a proxy, but a far closer one than finished gasoline.",
    },
    "kerosene": {
        "pricing_mode": "direct_market_benchmark",
        "source": "EIA",
        "benchmark": "jetfuel_usd_gal",
        "benchmark_label": "EIA Gulf Coast kerosene-type jet fuel",
        "ui_label": "EIA jet-fuel benchmark",
        "confidence": "high",
        "basis_cad_m3": 0.0,
        "note": "A real middle-distillate benchmark for this cut. Gulf Coast "
                "rather than Western Canada, so basis risk remains.",
    },
    "diesel": {
        "pricing_mode": "direct_market_benchmark",
        "source": "EIA",
        "benchmark": "ulsd_gc_usd_gal",
        "benchmark_label": "EIA Gulf Coast ULSD",
        "ui_label": "EIA ULSD benchmark",
        "confidence": "high",
        "basis_cad_m3": 0.0,
        "alternate_benchmarks": ["ulsd_nyh_usd_gal"],
        "note": "Bulk refined diesel market value, not a pump price. Switch "
                "to ulsd_nyh_usd_gal by editing `benchmark` if preferred.",
    },
    "swing_naphtha": {
        "pricing_mode": "opportunity_value",
        "low_anchor": "naphtha",
        "high_anchor": "kerosene",
        "ui_label": "Model-derived opportunity value",
        "confidence": "model_derived",
        "basis_cad_m3": 0.0,
        "note": "The 128 to 145 C cut is worth whatever pool it is sent to. "
                "Valued as a blend of the naphtha and kerosene pools.",
    },
    "swing_diesel": {
        "pricing_mode": "opportunity_value",
        "high_anchor": "diesel",
        "low_anchor": "uco",
        "ui_label": "Model-derived opportunity value",
        "confidence": "model_derived",
        "basis_cad_m3": 0.0,
        "note": "The 340 to 385 C cut is worth whatever pool it is sent to. "
                "Valued between the diesel pool and unconverted oil.",
    },
    "uco": {
        "pricing_mode": "opportunity_value_proxy",
        "anchor": "wcs_usd_bbl",
        "anchor_label": "WCS heavy crude",
        "anchor_factor": 0.825,
        "ui_label": "Heavy-product opportunity-value proxy",
        "confidence": "medium_low",
        "basis_cad_m3": 0.0,
        "note": "EIA discontinued residual fuel oil price reporting in March "
                "2022, so there is no live heavy-product series to anchor on. "
                "Unconverted oil above 385 C is heavy material, so it is "
                "valued as a fraction of the live heavy crude benchmark "
                "already in the model. The factor is calibrated to the "
                "workbook's reference price and is the number to revisit "
                "first if a VGO or resid assessment becomes available.",
    },
}

# How much of each swing cut goes to its higher-value destination. Override
# from the refinery's own disposition if the process model knows it.
SWING_NAPHTHA_TO_KEROSENE_FRACTION = 0.5   # 0 = all naphtha pool, 1 = all kerosene
SWING_DIESEL_TO_DIESEL_FRACTION = 0.5      # 0 = all UCO, 1 = all diesel pool


# The fixed prices the source workbook assumes, C$/m3. Reported alongside the
# market estimate so the two can be compared. READ ONLY as far as the
# calculation is concerned: nothing here ever clamps, scales, or calibrates an
# estimate. See the note at the top of this file.
CLIENT_REFERENCE_RANGE = {
    "lpg":           (650, 780),
    "naphtha":       (720, 810),
    "swing_naphtha": (760, 850),
    "kerosene":      (1150, 1300),
    "diesel":        (1100, 1280),
    "swing_diesel":  (1000, 1150),
    "uco":           (520, 650),
}


def compare_to_client_range(product, price_cad_m3, ranges=None):
    """
    Where a market estimate sits against the workbook's assumed price.

    Returns {"low", "high", "position", "gap_cad_m3", "ratio"} where position
    is below, inside or above. gap_cad_m3 is signed distance to the nearest
    end of the range and is zero when the estimate is inside it.
    """
    table = ranges or CLIENT_REFERENCE_RANGE
    if product not in table or price_cad_m3 is None:
        return None
    low, high = table[product]
    midpoint = (low + high) / 2.0
    if price_cad_m3 < low:
        position, gap = "below", price_cad_m3 - low
    elif price_cad_m3 > high:
        position, gap = "above", price_cad_m3 - high
    else:
        position, gap = "inside", 0.0
    return {"low": low, "high": high, "position": position,
            "gap_cad_m3": gap, "ratio": price_cad_m3 / midpoint}


# =============================================================================
# 2. UNIT CONVERSION
# =============================================================================
# Apply the conversion that matches the SERIES unit. Using the crude per-barrel
# factor on a per-gallon product price overstates it about 42-fold.

GAL_PER_M3 = 264.172052      # 1 m3 / 0.003785411784 m3 per US gallon
BBL_PER_M3 = 6.28981077


def usd_gal_to_cad_m3(usd_per_gal, usd_cad):
    """US$/gallon to C$/m3."""
    if usd_per_gal is None or usd_cad is None:
        return None
    return float(usd_per_gal) * GAL_PER_M3 * float(usd_cad)


def usd_bbl_to_cad_m3(usd_per_bbl, usd_cad):
    """US$/bbl to C$/m3."""
    if usd_per_bbl is None or usd_cad is None:
        return None
    return float(usd_per_bbl) * BBL_PER_M3 * float(usd_cad)


def to_cad_m3(value, unit, usd_cad):
    """Convert by the series' own unit. Anything else is a programming error."""
    if unit == "usd_gal":
        return usd_gal_to_cad_m3(value, usd_cad)
    if unit == "usd_bbl":
        return usd_bbl_to_cad_m3(value, usd_cad)
    raise ValueError(f"unknown price unit: {unit!r}")


# =============================================================================
# 3. FRESHNESS
# =============================================================================
# Counted in business days, so a Monday reading a Friday observation is
# current rather than three days stale.

FRESHNESS_CURRENT_DAYS = 3
FRESHNESS_RECENT_DAYS = 7


def business_days_between(start, end):
    """Weekdays from start to end, ignoring statutory holidays."""
    if start is None or end is None or end < start:
        return None
    days, cursor = 0, start
    while cursor < end:
        cursor = date.fromordinal(cursor.toordinal() + 1)
        if cursor.weekday() < 5:
            days += 1
    return days


def _parse_date(text):
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(str(text)[:10], fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def freshness(observation_date, today=None):
    """
    Classify how old an observation is.
      current | recent | stale | unknown
    """
    observed = _parse_date(observation_date)
    if observed is None:
        return {"status": "unknown", "business_days_old": None,
                "observation_date": observation_date}
    age = business_days_between(observed, today or date.today())
    status = ("current" if age <= FRESHNESS_CURRENT_DAYS
              else "recent" if age <= FRESHNESS_RECENT_DAYS
              else "stale")
    return {"status": status, "business_days_old": age,
            "observation_date": str(observed)}


# =============================================================================
# 4. PRICING
# =============================================================================

def _anchor_detail(leg):
    """
    The arithmetic behind one Alberta anchored price, flattened for display.

    A single component (naphtha) reports its own legs. A blended one (LPG)
    reports each component plus the composition used.
    """
    if leg is None:
        return None
    detail = {"basis": leg.get("basis"), "price_cad_m3": leg.get("price_cad_m3")}
    if "components" in leg:
        detail["components"] = {
            name: {k: comp.get(k) for k in
                   ("anchor_cad_m3", "driver_label", "driver_month_average",
                    "driver_today", "factor_k", "movement", "price_cad_m3")}
            for name, comp in leg["components"].items()}
        detail["composition"] = leg.get("composition")
    else:
        for k in ("anchor_cad_m3", "driver_label", "driver_month_average",
                  "driver_today", "factor_k", "movement"):
            detail[k] = leg.get(k)
    return detail


def _benchmark_price(product, benchmarks, usd_cad, config):
    """One directly benchmarked or proxied product."""
    cfg = config[product]
    row = benchmarks.get(cfg["benchmark"])
    if not row or row.get("value") is None:
        return None, None
    unit = row.get("unit", "usd_gal")
    cad = to_cad_m3(row["value"], unit, usd_cad)
    if cad is None:
        return None, None
    return cad + cfg.get("basis_cad_m3", 0.0), row.get("date")


def _inherit_freshness(computed, inputs):
    """
    A derived price is only as fresh as the oldest thing it was built from,
    so it reports the worst freshness among its inputs rather than "unknown".
    """
    order = {"current": 0, "recent": 1, "stale": 2, "unknown": 3}
    worst, oldest = "current", None
    for name in inputs:
        f = computed.get(name, {}).get("freshness", {})
        status = f.get("status", "unknown")
        if order.get(status, 3) > order.get(worst, 0):
            worst = status
        age = f.get("business_days_old")
        if age is not None and (oldest is None or age > oldest):
            oldest = age
    return {"status": worst, "business_days_old": oldest,
            "observation_date": "derived from " + " and ".join(inputs)}


def estimate_product_prices(benchmarks, usd_cad, wcs_usd_bbl=None,
                            config=None, swing_naphtha_to_kerosene=None,
                            swing_diesel_to_diesel=None, previous=None,
                            today=None, ngl=None):
    """
    Estimated refinery-gate market values for all seven products, C$/m3.

    benchmarks : {series_key: {"value": float, "unit": "usd_gal"|"usd_bbl",
                               "date": "YYYY-MM-DD"}}
                 Use the project's existing EIA fetch to build this.
    wcs_usd_bbl: live WCS, used as the UCO anchor.
    ngl        : output of alberta_ngl_pricing.build_ngl_prices, supplying the
                 Alberta anchored LPG and naphtha values. When it is missing
                 or incomplete, both fall back to the old EIA proxy and say so
                 in `ui_label` rather than silently reporting an anchored
                 price that was never anchored.
    previous   : a prior result. On a failed fetch the last good price and its
                 original observation date are kept and marked stale, rather
                 than being written as zero.

    Returns {product: {price_cad_m3, pricing_mode, benchmark, observation_date,
                       freshness, confidence, inputs, ui_label, is_estimate}}.
    """
    cfg = config or PRODUCT_PRICING
    to_kero = (SWING_NAPHTHA_TO_KEROSENE_FRACTION
               if swing_naphtha_to_kerosene is None else swing_naphtha_to_kerosene)
    to_diesel = (SWING_DIESEL_TO_DIESEL_FRACTION
                 if swing_diesel_to_diesel is None else swing_diesel_to_diesel)
    out = {}

    def record(product, price, observed, inputs=None):
        c = cfg[product]
        entry = {
            "price_cad_m3": price,
            "pricing_mode": c["pricing_mode"],
            "confidence": c["confidence"],
            "ui_label": c["ui_label"],
            "basis_cad_m3": c.get("basis_cad_m3", 0.0),
            "note": c.get("note"),
            "is_estimate": True,
            "inputs": inputs,
            "benchmark": c.get("benchmark_label") or c.get("anchor_label"),
            "freshness": freshness(observed, today),
        }
        # Keep the last good number rather than writing a zero.
        if price is None and previous and previous.get(product, {}).get("price_cad_m3") is not None:
            keep = previous[product]
            entry["price_cad_m3"] = keep["price_cad_m3"]
            entry["freshness"] = dict(keep.get("freshness", {}))
            entry["freshness"]["status"] = "stale"
            entry["source_status"] = "error, showing last good price"
        elif price is None:
            entry["source_status"] = "unavailable"
        out[product] = entry

    # -- 1. Alberta anchored products --------------------------------------
    # These two carry their own arithmetic so the result can be checked by
    # hand: anchor, factor, driver, price.
    for product in ("lpg", "naphtha"):
        leg = (ngl or {}).get(product)
        price = (leg or {}).get("price_cad_m3")
        if price is None:
            # No anchor available. Fall back to the pre-v2 proxy and label it
            # honestly rather than presenting a proxy as an anchored price.
            price, observed = _benchmark_price(product, benchmarks, usd_cad, cfg)
            record(product, price, observed)
            out[product]["pricing_mode"] = "market_proxy"
            out[product]["ui_label"] = (cfg[product]["benchmark_label"]
                                        + ", anchor unavailable")
            out[product]["anchor_status"] = "unavailable, using proxy"
            continue
        record(product, price + cfg[product].get("basis_cad_m3", 0.0),
               (leg.get("driver_today_date")
                or benchmarks.get(cfg[product]["benchmark"], {}).get("date")))
        out[product]["anchor_status"] = "anchored"
        out[product]["anchor"] = _anchor_detail(leg)

    # -- 2. direct benchmarks ----------------------------------------------
    for product in ("kerosene", "diesel"):
        price, observed = _benchmark_price(product, benchmarks, usd_cad, cfg)
        record(product, price, observed)

    # -- 3. UCO, anchored on live heavy crude ------------------------------
    uco_cfg = cfg["uco"]
    uco_price = None
    if wcs_usd_bbl is not None:
        uco_price = (usd_bbl_to_cad_m3(wcs_usd_bbl, usd_cad)
                     * uco_cfg["anchor_factor"] + uco_cfg.get("basis_cad_m3", 0.0))
    record("uco", uco_price, benchmarks.get("wcs_date"),
           inputs=[uco_cfg["anchor"]])

    # -- 4. swing diesel, between the diesel pool and UCO -------------------
    diesel_price = out["diesel"]["price_cad_m3"]
    uco_now = out["uco"]["price_cad_m3"]
    swing_diesel = (to_diesel * diesel_price + (1 - to_diesel) * uco_now
                    if diesel_price is not None and uco_now is not None else None)
    record("swing_diesel", swing_diesel, None, inputs=["diesel", "uco"])
    out["swing_diesel"]["allocation"] = {"to_diesel_fraction": to_diesel}
    out["swing_diesel"]["freshness"] = _inherit_freshness(out, ["diesel", "uco"])

    # -- 5. swing naphtha, between the naphtha and kerosene pools -----------
    naphtha_price = out["naphtha"]["price_cad_m3"]
    kerosene_price = out["kerosene"]["price_cad_m3"]
    swing_naphtha = ((1 - to_kero) * naphtha_price + to_kero * kerosene_price
                     if naphtha_price is not None and kerosene_price is not None
                     else None)
    record("swing_naphtha", swing_naphtha, None, inputs=["naphtha", "kerosene"])
    out["swing_naphtha"]["allocation"] = {"to_kerosene_fraction": to_kero}
    out["swing_naphtha"]["freshness"] = _inherit_freshness(out, ["naphtha", "kerosene"])

    # -- 6. compare against the workbook's assumption, without changing it --
    for product in PRODUCTS:
        out[product]["client_range"] = compare_to_client_range(
            product, out[product]["price_cad_m3"])

    return out


def live_differential(product, live_prices, base_prices):
    """
    Live market value less the model's base price, C$/m3. Positive means the
    market is above the scenario assumption.
    """
    live = (live_prices.get(product) or {}).get("price_cad_m3")
    base = base_prices.get(product)
    if live is None or base is None:
        return None
    return live - base


# =============================================================================
# 5. SELF-TEST
# =============================================================================

if __name__ == "__main__":
    print("Refinery product market-value layer - self-test")
    print("=" * 70)

    benchmarks = {
        "propane_usd_gal":  {"value": 0.723, "unit": "usd_gal", "date": "2026-08-18"},
        "gasoline_usd_gal": {"value": 3.318, "unit": "usd_gal", "date": "2026-08-18"},
        "jetfuel_usd_gal":  {"value": 3.960, "unit": "usd_gal", "date": "2026-08-18"},
        "ulsd_gc_usd_gal":  {"value": 4.422, "unit": "usd_gal", "date": "2026-08-18"},
        "wcs_date": "2026-08-18",
    }
    # Alberta anchors, live where reachable, last verified set otherwise.
    import alberta_ngl_pricing as ang
    live = ang.fetch_alberta_ngl_prices()
    anchors = live["value"] or {"propane_cad_m3": 173.00,
                                "butanes_cad_m3": 231.64,
                                "pentanes_plus_cad_m3": 709.05}
    anchor_month = live["detail"].get("anchor_month") or "2026-06"
    ngl = ang.build_ngl_prices(
        anchors,
        {"gasoline_usd_gal": 3.0119, "propane_usd_gal": 0.7551},
        {"gasoline_usd_gal": 3.318, "propane_usd_gal": 0.723})
    print(f"\n  Alberta anchor month {anchor_month}, live={live['ok']}")

    prices = estimate_product_prices(benchmarks, usd_cad=1.37, wcs_usd_bbl=73.18,
                                     today=date(2026, 8, 24), ngl=ngl)

    print(f"\n  {'product':16s} {'C$/m3':>9s}  {'mode':24s} {'vs workbook':>18s}  label")
    for p in PRODUCTS:
        r = prices[p]
        v = f"{r['price_cad_m3']:9.2f}" if r["price_cad_m3"] is not None else "        -"
        cr = r.get("client_range")
        vs = (f"{cr['position']:>6s} {cr['low']}-{cr['high']}" if cr else "")
        print(f"  {p:16s} {v}  {r['pricing_mode']:24s} {vs:>18s}  {r['ui_label']}")

    print("\n  Alberta anchored arithmetic, checkable by hand")
    a = prices["naphtha"]["anchor"]
    print(f"    naphtha  {a['anchor_cad_m3']:.2f} x "
          f"({a['driver_today']:.4f} / {a['driver_month_average']:.4f}) "
          f"= {a['price_cad_m3']:.2f} C$/m3")
    a = prices["lpg"]["anchor"]
    for name, leg in a["components"].items():
        print(f"    {name:8s} {leg['anchor_cad_m3']:7.2f} x {leg['movement']:.4f} "
              f"= {leg['price_cad_m3']:7.2f}   ({leg['driver_label']})")
    print(f"    pool     {a['composition']['propane_cad_m3']:.3f} C3 + "
          f"{a['composition']['butanes_cad_m3']:.3f} C4 = "
          f"{a['price_cad_m3']:.2f} C$/m3")

    print("\n  The workbook comparison never touches the estimate")
    for p in ("naphtha", "lpg"):
        cr = prices[p]["client_range"]
        print(f"    {p:8s} estimate {prices[p]['price_cad_m3']:7.2f}, workbook "
              f"{cr['low']}-{cr['high']}, {cr['position']}"
              + (f", gap {cr['gap_cad_m3']:+.0f} C$/m3" if cr["gap_cad_m3"] else ""))
    print("    Reported as-is. No factor is fitted to close a gap.")

    print("\n  Swing arithmetic")
    n, k = prices["naphtha"]["price_cad_m3"], prices["kerosene"]["price_cad_m3"]
    d, u = prices["diesel"]["price_cad_m3"], prices["uco"]["price_cad_m3"]
    print(f"    swing naphtha = 0.5 x {n:.2f} naphtha + 0.5 x {k:.2f} kerosene "
          f"= {prices['swing_naphtha']['price_cad_m3']:.2f}")
    print(f"    swing diesel  = 0.5 x {d:.2f} diesel  + 0.5 x {u:.2f} UCO      "
          f"= {prices['swing_diesel']['price_cad_m3']:.2f}")

    print("\n  Unit conversion, the trap")
    print(f"    2.50 US$/gal at 1.38 -> {usd_gal_to_cad_m3(2.50, 1.38):.1f} C$/m3 "
          f"(spec expects about 911.4)")
    print(f"    same number through the per-barrel factor -> "
          f"{usd_bbl_to_cad_m3(2.50, 1.38):.1f} C$/m3, wrong by "
          f"{usd_gal_to_cad_m3(2.50, 1.38) / usd_bbl_to_cad_m3(2.50, 1.38):.0f}x")

    print("\n  Freshness, business days")
    for label, obs in [("Friday obs, read Monday", "2026-08-21"),
                       ("6 days old", "2026-08-14"),
                       ("a month old", "2026-07-20")]:
        f = freshness(obs, date(2026, 8, 24))
        print(f"    {label:24s} {obs}  {f['business_days_old']} business days  "
              f"{f['status']}")

    print("\n  Failed fetch keeps the last good price")
    broken = dict(benchmarks); broken["ulsd_gc_usd_gal"] = {"value": None}
    after = estimate_product_prices(broken, usd_cad=1.37, wcs_usd_bbl=73.18,
                                    previous=prices, today=date(2026, 8, 24))
    print(f"    diesel now {after['diesel']['price_cad_m3']:.2f} C$/m3, "
          f"status '{after['diesel'].get('source_status')}', "
          f"freshness '{after['diesel']['freshness']['status']}'")
    print(f"    not zero: {after['diesel']['price_cad_m3'] != 0}")
