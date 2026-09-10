"""
Canadian Crude Pricing Layer
Version: 1.0
Date: 2026-08-24

Estimates daily acquisition prices for the five Canadian crude feeds used by
the Crude to Profit model, in USD/bbl and then C$/m3.

Two stages, deliberately kept separate:

    stage 1   WCS  = WTI + wcs_wti_differential      (differential is signed,
                                                      normally negative)
    stage 2   feed = WCS + grade_differential        (per-grade, from config)

Then, and only then, currency:

    C$/m3 = USD/bbl * USD_CAD * 6.28981077

Every output of this module is a MODEL-DERIVED ESTIMATE, not a licensed market
assessment. The grade differentials are a calibration snapshot, not a market
relationship that holds over time. See PROVENANCE below and `calibrated_date`
on each feed.

PROVENANCE
    EIA daily WTI
        + latest available WCS-WTI differential   (Alberta Economic Data)
        = estimated daily WCS
        + configured grade differential            (this module)
        = estimated feed price, USD/bbl
        * USD/CAD
        = C$/m3
    -> refinery margin model

The grade differentials were calibrated by hand against publicly displayed
Canadian grade prices on one date. That reference was read manually and is not
called, scraped, or parsed by this or any other code in the project. What was
carried across is the differential structure, not anyone's webpage.

Usage:
    from canadian_crude_pricing import estimate_feed_prices
    prices = estimate_feed_prices(wti_usd_bbl=89.41,
                                  wcs_wti_differential=-14.70,
                                  usd_cad=1.37)
"""

# =============================================================================
# 1. CONFIGURATION  (the only place differentials should ever be edited)
# =============================================================================
# To re-calibrate, change `differential_to_wcs` and `calibrated_date` here.
# No other file should need touching. This dict is the JSON-equivalent config
# the spec calls for; it is a Python dict rather than a .json file to match the
# project's existing convention (engine.DEFAULT_CONFIG) and its stdlib-only
# rule. Swapping it for json.load() is a one-line change if that is preferred.

CANADIAN_CRUDE_PRICING = {
    "base_benchmark": "WCS",
    "currency": "USD",
    "price_unit": "bbl",
    "feeds": {
        "AWB": {
            "name": "Access Western Blend",
            "pricing_anchor": "Access Western Blend",
            "pricing_mode": "benchmark_spread",
            "differential_to_wcs": 11.45,
            "confidence": "high",
            "mapping_type": "exact",
            "calibrated_date": "2026-08-24",
            "status": "reference-calibrated",
            "note": "Named-stream match. The feed and the reference grade are "
                    "the same stream.",
        },
        "OSA": {
            "name": "Suncor Synthetic A",
            "pricing_anchor": "Syncrude Sweet Premium",
            "pricing_mode": "benchmark_spread",
            "differential_to_wcs": 8.85,
            "confidence": "high_proxy",
            "mapping_type": "proxy",
            "calibrated_date": "2026-08-24",
            "status": "reference-calibrated",
            "note": "Both light sweet synthetics. OSA about 32.4 API / 0.21 % S "
                    "against SSP about 33.2 API / 0.19 % S.",
        },
        "OSH": {
            "name": "Suncor Synthetic H",
            "pricing_anchor": "Albian Heavy Synthetic",
            "pricing_mode": "benchmark_spread",
            "differential_to_wcs": 11.85,
            "confidence": "low_medium_proxy",
            "mapping_type": "proxy",
            "calibrated_date": "2026-08-24",
            "status": "reference-calibrated",
            "note": "Weakest mapping. Similar API and sulfur, but materially "
                    "different refining behaviour: OSH is a bottomless upgraded "
                    "synthetic with about 0.9 % MCR against AHS at about 13.4 %, "
                    "and TAN about 3.5 against about 0.7.",
        },
        "SHD": {
            "name": "Surmont Heavy Dilbit",
            "pricing_anchor": "Access Western Blend",
            "pricing_mode": "benchmark_spread",
            "differential_to_wcs": 11.45,
            "confidence": "medium_proxy",
            "mapping_type": "proxy",
            "calibrated_date": "2026-08-24",
            "status": "reference-calibrated",
            "note": "Both heavy sour unconventional dilbits with close assays: "
                    "API about 21.5 against 22.1, sulfur about 4.1 % against "
                    "3.9 %, TAN about 1.7 against 1.6, MCR about 10.5 % against "
                    "10.6 %. No extra quality penalty applied.",
        },
        "FRB": {
            "name": "Fort Hills Dilbit",
            "pricing_anchor": "Access Western Blend",
            "pricing_mode": "benchmark_spread",
            "differential_to_wcs": 11.45,
            "confidence": "medium_low_proxy",
            "mapping_type": "proxy",
            "calibrated_date": "2026-08-24",
            "status": "reference-calibrated",
            "note": "Heavy sour unconventional, so AWB is the best available "
                    "anchor, but less alike than SHD: API about 20.6, sulfur "
                    "about 4.0 %, MCR about 9.1 %, TAN about 2.0.",
        },
    },
}

# Per-feed adjustments layered on top of the anchor differential. Held at zero
# until market evidence supports another value. Present so a future
# SHD = AWB + adjustment does not require touching the pricing code.
FEED_ADJUSTMENTS_USD_BBL = {
    "AWB": 0.0,
    "OSA": 0.0,
    "OSH": 0.0,
    "SHD": 0.0,
    "FRB": 0.0,
}

FEEDS = ("AWB", "OSA", "OSH", "SHD", "FRB")

# Confidence ordering, strongest first. Useful for sorting a UI and for any
# later uncertainty banding.
CONFIDENCE_RANK = {
    "exact": 0, "high": 0, "high_proxy": 1, "medium_proxy": 2,
    "medium_low_proxy": 3, "low_medium_proxy": 4,
}

# Barrels per cubic metre, exact definition.
# NOTE: engine.M3_TO_BBL is 6.290123456790123, the value carried in the source
# workbook. It is about 0.005 % off this one. The workbook value stays where it
# is because the engine's volume calculations tie out against that workbook.
# This constant is used only for currency conversion of prices. Do not
# "reconcile" the two: changing the workbook value breaks the tie-out test.
BBL_PER_M3 = 6.28981077


# =============================================================================
# 2. STAGE 1 - DAILY WCS
# =============================================================================

def calculate_wcs(wti_usd_bbl, wcs_wti_differential):
    """
    Daily WCS from daily WTI and the latest WCS-WTI differential.

        WCS = WTI + differential

    The differential is SIGNED and is normally negative, because WCS trades at
    a discount to WTI.

        >>> round(calculate_wcs(89.41, -14.70), 2)
        74.71

    Use signed_differential() when the source publishes the discount as a
    positive magnitude, which Alberta's does.
    """
    if wti_usd_bbl is None or wcs_wti_differential is None:
        return None
    return float(wti_usd_bbl) + float(wcs_wti_differential)


def signed_differential(published_value, published_as="discount_magnitude"):
    """
    Normalise a WCS-WTI differential to the signed convention this module uses.

    The Alberta Economic Data API publishes the differential as a positive
    discount magnitude: WTI 80.46, WCS 67.16, Differential 13.30. Feeding that
    straight into calculate_wcs() would put WCS about 27 dollars too high, so
    it is negated here.

        published_as="discount_magnitude"  positive number, WCS below WTI
        published_as="signed"              already signed, passed through
    """
    if published_value is None:
        return None
    value = float(published_value)
    if published_as == "signed":
        return value
    if published_as == "discount_magnitude":
        return -abs(value)
    raise ValueError(f"unknown published_as: {published_as}")


# =============================================================================
# 3. STAGE 2 - GRADE DIFFERENTIALS
# =============================================================================

def calculate_canadian_crude_price(wcs_usd_bbl, feed_code, config=None,
                                   adjustments=None):
    """
    One feed price from WCS plus its configured grade differential.

        feed = WCS + differential_to_wcs + adjustment

        >>> round(calculate_canadian_crude_price(74.71, "AWB"), 2)
        86.16
    """
    cfg = (config or CANADIAN_CRUDE_PRICING)["feeds"]
    if feed_code not in cfg:
        raise KeyError(f"no pricing config for feed {feed_code!r}")
    if wcs_usd_bbl is None:
        return None
    adj = (adjustments or FEED_ADJUSTMENTS_USD_BBL).get(feed_code, 0.0)
    return float(wcs_usd_bbl) + cfg[feed_code]["differential_to_wcs"] + adj


def calculate_all_feed_prices(wcs_usd_bbl, config=None, adjustments=None):
    """All five feed prices in USD/bbl, keyed by feed code."""
    return {code: calculate_canadian_crude_price(wcs_usd_bbl, code, config,
                                                 adjustments)
            for code in FEEDS}


# =============================================================================
# 4. CURRENCY
# =============================================================================
# Kept deliberately separate from the differential arithmetic. Crude maths
# happens entirely in USD/bbl; currency is applied once, at the end.

def usd_bbl_to_cad_m3(usd_per_bbl, usd_cad_rate):
    """
        C$/m3 = USD/bbl * 6.28981077 * USD/CAD

    The barrel factor is applied before the exchange rate, matching every
    other conversion in the project. Floating point is not associative, so a
    different order here would make this module disagree with the others in
    the last bit for no reason.
    """
    if usd_per_bbl is None or usd_cad_rate is None:
        return None
    return float(usd_per_bbl) * BBL_PER_M3 * float(usd_cad_rate)


# =============================================================================
# 5. PROVENANCE AND UI METADATA
# =============================================================================

_WORDING = {
    "AWB": "Estimated from WCS + Access Western Blend differential",
    "OSA": "Estimated from WCS + Syncrude Sweet Premium proxy differential",
    "OSH": "Estimated from WCS + Albian Heavy Synthetic proxy differential",
    "SHD": "Estimated using Access Western Blend as a comparable heavy-dilbit "
           "proxy",
    "FRB": "Estimated using Access Western Blend as a comparable heavy-dilbit "
           "proxy",
}


def price_provenance(feed_code, config=None):
    """
    Everything a UI needs to show how a feed price was arrived at, and how much
    to trust it. Returned per feed rather than as a global banner, so a
    dashboard can be quiet by default and detailed on demand.
    """
    cfg = (config or CANADIAN_CRUDE_PRICING)["feeds"][feed_code]
    return {
        "feed": feed_code,
        "name": cfg["name"],
        "pricing_anchor": cfg["pricing_anchor"],
        "pricing_mode": cfg["pricing_mode"],
        "differential_to_wcs": cfg["differential_to_wcs"],
        "mapping_type": cfg["mapping_type"],
        "confidence": cfg["confidence"],
        "confidence_rank": CONFIDENCE_RANK.get(cfg["confidence"], 9),
        "calibrated_date": cfg["calibrated_date"],
        "status": cfg["status"],
        "wording": _WORDING[feed_code],
        "note": cfg["note"],
        "is_estimate": True,
    }


# =============================================================================
# 6. FULL CHAIN
# =============================================================================

def estimate_feed_prices(wti_usd_bbl, wcs_wti_differential, usd_cad=None,
                         config=None, adjustments=None,
                         differential_published_as="signed"):
    """
    WTI and a WCS-WTI differential in, five estimated feed prices out.

    Set differential_published_as="discount_magnitude" when handing this a
    positive number straight from Alberta.

    Returns the WCS it derived, each feed in USD/bbl, each feed in C$/m3 when
    an FX rate was supplied, and the provenance block for each.
    """
    diff = signed_differential(wcs_wti_differential, differential_published_as)
    wcs = calculate_wcs(wti_usd_bbl, diff)
    usd = calculate_all_feed_prices(wcs, config, adjustments)
    cad = {c: usd_bbl_to_cad_m3(v, usd_cad) for c, v in usd.items()} \
        if usd_cad is not None else {c: None for c in usd}
    return {
        "wti_usd_bbl": wti_usd_bbl,
        "wcs_wti_differential": diff,
        "wcs_usd_bbl": wcs,
        "usd_cad": usd_cad,
        "feeds_usd_bbl": usd,
        "feeds_cad_m3": cad,
        "provenance": {c: price_provenance(c, config) for c in FEEDS},
        "is_estimate": True,
    }


def estimate_from_live_sources(usd_cad=None, wti_manual=None,
                               differential_manual=None, config=None,
                               adjustments=None):
    """
    Same as estimate_feed_prices(), but sources WTI and the differential from
    the project's existing live feeds: EIA for daily WTI, Alberta Economic Data
    for the differential. Both fall back to a manual value and neither raises.

    Imported lazily so this module stays usable on its own.
    """
    import engine as E

    wti = E.fetch_wti_usd_bbl(wti_manual)
    alberta = E.fetch_alberta_oil_prices()

    diff_value, diff_date, diff_source = None, None, "unavailable"
    if alberta["ok"] and "Differential" in alberta["value"]:
        diff_value, diff_date = alberta["value"]["Differential"]
        diff_source = "alberta"
    elif differential_manual is not None:
        diff_value, diff_source = abs(float(differential_manual)), "manual"

    if wti["value"] is None or diff_value is None:
        return {"ok": False, "reason": "no WTI or no differential available",
                "wti": wti, "differential_source": diff_source}

    out = estimate_feed_prices(wti["value"], diff_value, usd_cad, config,
                               adjustments,
                               differential_published_as="discount_magnitude")
    out.update({
        "ok": True,
        "wti_source": wti["source"],
        "wti_date": wti.get("detail"),
        "differential_source": diff_source,
        "differential_date": diff_date,
    })
    return out


# =============================================================================
# 7. SELF-TEST
# =============================================================================

if __name__ == "__main__":
    print("Canadian crude pricing - self-test")
    print("=" * 68)

    # -- Spec validation case ---------------------------------------------
    print("\nStage 1: WCS from WTI and a signed differential")
    wcs = calculate_wcs(89.41, -14.70)
    print(f"  WTI 89.41 + (-14.70) = {wcs:.2f} USD/bbl   "
          f"{'OK' if abs(wcs - 74.71) < 1e-9 else 'MISMATCH'}")

    print("\nStage 2: feed prices at WCS = 74.71")
    EXPECTED = {"AWB": 86.16, "OSA": 83.56, "OSH": 86.56,
                "SHD": 86.16, "FRB": 86.16}
    prices = calculate_all_feed_prices(74.71)
    ok = True
    for code in FEEDS:
        got, want = prices[code], EXPECTED[code]
        match = abs(got - want) < 1e-9
        ok &= match
        cfg = CANADIAN_CRUDE_PRICING["feeds"][code]
        print(f"  {code}  74.71 + {cfg['differential_to_wcs']:5.2f} = "
              f"{got:6.2f} vs {want:6.2f}  {'OK' if match else 'MISMATCH'}")
    print(f"\n  Spec validation case passes: {ok}")

    # -- Sign handling -----------------------------------------------------
    print("\nSign handling (the trap)")
    print(f"  Alberta publishes a positive discount magnitude, e.g. 13.30")
    print(f"  signed_differential(13.30) = {signed_differential(13.30)}")
    print(f"  WCS from WTI 80.46        = "
          f"{calculate_wcs(80.46, signed_differential(13.30)):.2f}  "
          f"(Alberta's own WCS that month was 67.16)")
    print(f"  Passing 13.30 unsigned would give "
          f"{calculate_wcs(80.46, 13.30):.2f}, which is wrong by "
          f"{calculate_wcs(80.46, 13.30) - 67.16:.2f}")

    # -- Currency ----------------------------------------------------------
    print("\nCurrency, applied once at the end")
    ex = usd_bbl_to_cad_m3(86.16, 1.37)
    print(f"  AWB 86.16 USD/bbl * 1.37 * {BBL_PER_M3} = {ex:.2f} C$/m3")

    # -- Provenance --------------------------------------------------------
    print("\nProvenance")
    for code in sorted(FEEDS, key=lambda c: price_provenance(c)["confidence_rank"]):
        p = price_provenance(code)
        bar = "#" * (5 - p["confidence_rank"]) + "." * p["confidence_rank"]
        print(f"  {code}  {bar}  {p['mapping_type']:5s}  anchor "
              f"{p['pricing_anchor']}")
        print(f"       {p['wording']}")

    # -- Live ---------------------------------------------------------------
    print("\n" + "=" * 68)
    print("Live chain (EIA WTI + Alberta differential)")
    live = estimate_from_live_sources(usd_cad=1.37)
    if live.get("ok"):
        print(f"  WTI {live['wti_usd_bbl']:.2f} ({live['wti_source']}, "
              f"{live['wti_date']})")
        print(f"  differential {live['wcs_wti_differential']:.2f} "
              f"({live['differential_source']}, {live['differential_date']})")
        print(f"  WCS {live['wcs_usd_bbl']:.2f} USD/bbl")
        print(f"  {'feed':5s} {'USD/bbl':>9s} {'C$/m3':>10s}   confidence")
        for c in FEEDS:
            print(f"  {c:5s} {live['feeds_usd_bbl'][c]:9.2f} "
                  f"{live['feeds_cad_m3'][c]:10.2f}   "
                  f"{live['provenance'][c]['confidence']}")
        print("\n  All five are model-derived estimates, not market "
              "assessments.")
    else:
        print(f"  unavailable: {live.get('reason')}")
