"""
Alberta NGL Reference Price anchoring
Version: 1.0
Date: 2026-08-25

Prices the LPG and naphtha streams from an Alberta anchor moved daily by a
US market driver, instead of pricing them off finished gasoline.

WHY THIS EXISTS
    Finished gasoline is a blended, spec-finished consumer fuel. Naphtha is a
    blendstock feeding into it. Pricing naphtha at the gasoline price
    overstates it by roughly 70 percent. Alberta's own Pentanes Plus
    reference price is a light-hydrocarbon price for this province, published
    in C$/m3, which is both the right market and the right unit.

HOW IT WORKS
    Two stages, the same shape as the crude side of the model.

    stage 1, monthly anchor
        Government of Alberta publishes a reference price each month.
        It lags about two months. Held alone it would go stale.

    stage 2, daily movement
        A US benchmark that publishes daily supplies the movement. The
        anchor is scaled by how far that benchmark has moved since the
        anchor month's own average:

            price_today = anchor_price x (driver_today / driver_anchor_month)

    Written as a factor, k = anchor_price / driver_anchor_month, so
    price_today = k x driver_today. k is recomputed every time a new Alberta
    month lands. It is NOT a constant and must never be hard-coded: over the
    first half of 2026 it moved 14 percent for pentanes plus, 22 percent for
    propane and 45 percent for butanes.

WHAT k IS NOT
    k is not a fitting parameter. It is the observed Alberta-versus-US basis
    for one month, computed from two published numbers. Never adjust it to
    make an output land inside an expected range. If the answer disagrees
    with an assumption, that disagreement is the result.

UNITS
    Alberta publishes in C$/m3 already, so no FX is applied to the anchor.
    The driver enters only as a ratio of two US$/gal numbers, and a ratio is
    dimensionless, so no FX is applied there either. Applying FX to either
    would double-count it.

SOURCE ACCESS
    open.alberta.ca runs a public CKAN API. Documented, no key, no scraping,
    no browser automation. Search the dataset, list its resources, take the
    monthly PDF, read the text. Standard library only.

Usage:
    from alberta_ngl_pricing import fetch_alberta_ngl_prices, anchored_price
"""

import json
import re
import urllib.error
import urllib.parse
import urllib.request
import zlib
from datetime import date

_HTTP_HEADERS = {"User-Agent": "Ferriq-CrudeToProfit/1.0"}
_HTTP_TIMEOUT_S = 90

CKAN_BASE = "https://open.alberta.ca/api/3/action"
DATASET_QUERY = '"reference price calculations"'

# The three Alberta lines this model uses, and the label each carries in the
# published table. "Spec" is the specification-grade product; "Mix" is the
# unfractionated stream and is deliberately not used.
ALBERTA_NGL_LINES = {
    "propane_cad_m3":       "Propane Spec Reference Price",
    "butanes_cad_m3":       "Butanes Spec Reference Price",
    "pentanes_plus_cad_m3": "Pentanes Plus Spec Reference Price",
}

# Which daily US benchmark moves each Alberta anchor between publications.
# Butane has no EIA daily series, so gasoline stands in for it; that is the
# weakest link in this layer and is labelled as such wherever it surfaces.
ANCHOR_DRIVERS = {
    "propane_cad_m3":       ("propane_usd_gal",  "EIA Mont Belvieu propane"),
    "butanes_cad_m3":       ("gasoline_usd_gal", "EIA gasoline, butane proxy"),
    "pentanes_plus_cad_m3": ("gasoline_usd_gal", "EIA Gulf Coast gasoline"),
}

# Composition of the refinery's LPG stream, volume fractions summing to 1.
# C3 against C4; iC4 and nC4 are not separately priced by Alberta.
LPG_COMPOSITION = {"propane_cad_m3": 0.258, "butanes_cad_m3": 0.742}


# =============================================================================
# 1. PDF TEXT, STANDARD LIBRARY ONLY
# =============================================================================
# The published PDF stores its text as plain literal strings inside Flate
# compressed content streams, so zlib plus the standard library is enough and
# the project keeps its zero-dependency property. Each visible run of text is
# one BT..ET block; the table is emitted as label, value, unit in order.

_STREAM_RE = re.compile(rb"stream\r?\n")
_TEXTBLOCK_RE = re.compile(rb"BT(.*?)ET", re.S)
_LITERAL_RE = re.compile(rb"\((?:\\.|[^\\()])*\)")


def pdf_text_runs(pdf_bytes):
    """Visible text runs from a PDF, in document order. [] if unreadable."""
    runs = []
    for match in _STREAM_RE.finditer(pdf_bytes):
        start = match.end()
        end = pdf_bytes.find(b"endstream", start)
        if end < 0:
            continue
        try:
            data = zlib.decompress(pdf_bytes[start:end])
        except zlib.error:
            continue
        if b"Tj" not in data and b"TJ" not in data:
            continue
        for block in _TEXTBLOCK_RE.finditer(data):
            pieces = []
            for literal in _LITERAL_RE.finditer(block.group(1)):
                text = literal.group(0)[1:-1]
                text = (text.replace(b"\\(", b"(").replace(b"\\)", b")")
                            .replace(b"\\\\", b"\\"))
                pieces.append(text)
            if pieces:
                runs.append(b"".join(pieces).decode("latin-1").strip())
    return runs


_MONEY_RE = re.compile(r"^\$([\d,]+\.?\d*)$")


def parse_ngl_table(runs):
    """
    Pull the NGL reference prices out of the text runs.

    Only a value immediately followed by the unit /m3 is accepted, so a
    per-gigajoule line such as ethane can never be mistaken for a per-cubic-
    metre one even if the table is reordered.
    """
    found = {}
    for key, label in ALBERTA_NGL_LINES.items():
        for i, run in enumerate(runs):
            if run.strip() != label:
                continue
            money = _MONEY_RE.match(runs[i + 1].strip()) if i + 1 < len(runs) else None
            unit = runs[i + 2].strip() if i + 2 < len(runs) else ""
            if money and unit.startswith("/m"):
                found[key] = float(money.group(1).replace(",", ""))
            break
    return found


# =============================================================================
# 2. FETCH
# =============================================================================

def _http_get(url, binary=False):
    req = urllib.request.Request(url, headers=_HTTP_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT_S) as resp:
            raw = resp.read()
        return raw if binary else json.loads(raw.decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError,
            TimeoutError, OSError):
        return None


_RESOURCE_MONTH_RE = re.compile(r"(\d{4})-(\d{2})\.pdf$", re.I)


def _latest_dataset_name(year_hint=None):
    """
    Newest 'Monthly reference price calculations [YYYY]' dataset.

    Found by search rather than by a stored id. Dataset ids change year to
    year, and the id quoted in most write-ups points at the 2007 archive.
    """
    url = (f"{CKAN_BASE}/package_search?"
           + urllib.parse.urlencode({"q": DATASET_QUERY, "rows": 30}))
    payload = _http_get(url)
    if not payload or not payload.get("success"):
        return None
    names = []
    for pkg in payload["result"]["results"]:
        m = re.search(r"monthly-reference-price-calculations-(\d{4})$",
                      pkg.get("name", ""))
        if m:
            names.append((int(m.group(1)), pkg["name"]))
    if not names:
        return None
    if year_hint:
        for year, name in names:
            if year == year_hint:
                return name
    return max(names)[1]


def fetch_alberta_ngl_prices(year_hint=None, manual=None):
    """
    Latest published Alberta NGL reference prices, C$/m3.

    Returns {"ok", "value": {propane_cad_m3, butanes_cad_m3,
             pentanes_plus_cad_m3}, "source", "detail": {"anchor_month",
             "dataset", "url"}}.

    Never raises. On any failure the manual values are returned with
    ok False, so the model runs offline and says plainly that it did.
    """
    dataset = _latest_dataset_name(year_hint)
    if dataset:
        payload = _http_get(f"{CKAN_BASE}/package_show?"
                            + urllib.parse.urlencode({"id": dataset}))
        if payload and payload.get("success"):
            months = []
            for res in payload["result"]["resources"]:
                m = _RESOURCE_MONTH_RE.search(res.get("url", ""))
                if m and (res.get("format") or "").upper() == "PDF":
                    months.append((m.group(1) + "-" + m.group(2), res["url"]))
            # Newest first, and fall back down the list if one will not parse.
            for anchor_month, url in sorted(months, reverse=True):
                pdf = _http_get(url, binary=True)
                if not pdf:
                    continue
                values = parse_ngl_table(pdf_text_runs(pdf))
                if len(values) == len(ALBERTA_NGL_LINES):
                    return {"ok": True, "value": values, "source": "alberta",
                            "detail": {"anchor_month": anchor_month,
                                       "dataset": dataset, "url": url}}
    if manual:
        return {"ok": False, "value": dict(manual), "source": "manual",
                "detail": {"anchor_month": (manual or {}).get("anchor_month")}}
    return {"ok": False, "value": None, "source": "unavailable", "detail": {}}


# =============================================================================
# 3. THE DAILY DRIVER, FROM EIA
# =============================================================================
# The anchor month average is computed from that month's own daily
# observations rather than read from EIA's monthly series, which is published
# rounded to three decimals. Averaging the dailies keeps the month average and
# today's spot on the same footing, which is what makes k meaningful.

EIA_SPOT_URL = "https://api.eia.gov/v2/petroleum/pri/spt/data/"

EIA_DRIVER_SERIES = {
    "gasoline_usd_gal": "EER_EPMRU_PF4_RGC_DPG",   # Gulf Coast conventional
    "propane_usd_gal":  "EER_EPLLPA_PF4_Y44MB_DPG", # Mont Belvieu propane
}


def _eia_rows(api_key, series_id, frequency, start=None, end=None, length=400,
              descending=False):
    params = {"api_key": api_key, "frequency": frequency, "data[0]": "value",
              "facets[series][]": series_id, "length": str(length)}
    if start:
        params["start"] = start
    if end:
        params["end"] = end
    if descending:
        params["sort[0][column]"] = "period"
        params["sort[0][direction]"] = "desc"
    payload = _http_get(EIA_SPOT_URL + "?" + urllib.parse.urlencode(params))
    try:
        return payload["response"]["data"]
    except (KeyError, TypeError):
        return []


def fetch_driver_month_average(series_key, anchor_month, api_key):
    """
    Mean of every daily observation in the anchor month, US$/gal.

    Returns {"ok", "value", "observations", "month"}.
    """
    series_id = EIA_DRIVER_SERIES.get(series_key, series_key)
    if not api_key or not anchor_month:
        return {"ok": False, "value": None, "observations": 0,
                "month": anchor_month}
    first, last = month_bounds(anchor_month)
    rows = _eia_rows(api_key, series_id, "daily",
                     start=str(first), end=str(last))
    values = []
    for row in rows:
        try:
            values.append(float(row["value"]))
        except (KeyError, TypeError, ValueError):
            continue
    if not values:
        return {"ok": False, "value": None, "observations": 0,
                "month": anchor_month}
    return {"ok": True, "value": sum(values) / len(values),
            "observations": len(values), "month": anchor_month}


def fetch_driver_today(series_key, api_key):
    """Most recent daily observation for one driver series, US$/gal."""
    series_id = EIA_DRIVER_SERIES.get(series_key, series_key)
    if not api_key:
        return {"ok": False, "value": None, "date": None}
    rows = _eia_rows(api_key, series_id, "daily", length=1, descending=True)
    if not rows:
        return {"ok": False, "value": None, "date": None}
    try:
        return {"ok": True, "value": float(rows[0]["value"]),
                "date": rows[0]["period"]}
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "value": None, "date": None}


def fetch_drivers(anchor_month, api_key):
    """Month averages and today's spot for every driver series needed."""
    needed = sorted({series for series, _ in ANCHOR_DRIVERS.values()})
    averages, todays, detail = {}, {}, {}
    for series in needed:
        avg = fetch_driver_month_average(series, anchor_month, api_key)
        now = fetch_driver_today(series, api_key)
        averages[series] = avg["value"]
        todays[series] = now["value"]
        detail[series] = {"month_average": avg, "today": now}
    return {"month_averages": averages, "today": todays, "detail": detail}


# =============================================================================
# 4. CALIBRATION AND ANCHORING
# =============================================================================

def month_bounds(anchor_month):
    """'YYYY-MM' to the first and last calendar day of that month."""
    year, month = (int(p) for p in anchor_month.split("-")[:2])
    first = date(year, month, 1)
    last = (date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1))
    return first, date.fromordinal(last.toordinal() - 1)


def calibrate_factor(anchor_cad_m3, driver_month_average):
    """
    k = Alberta anchor / the driver's average over that same month.

    Both legs must describe the SAME month or k absorbs a price move that
    belongs to the daily leg and the whole estimate shifts.
    """
    if anchor_cad_m3 is None or not driver_month_average:
        return None
    return float(anchor_cad_m3) / float(driver_month_average)


def anchored_price(anchor_cad_m3, driver_month_average, driver_today):
    """
    Roll a monthly Alberta anchor forward to today.

        price_today = anchor x (driver_today / driver_anchor_month)

    No FX anywhere: the anchor is already Canadian, the driver is a ratio.
    """
    k = calibrate_factor(anchor_cad_m3, driver_month_average)
    if k is None or driver_today is None:
        return None
    return k * float(driver_today)


def blend_lpg(propane_cad_m3, butanes_cad_m3, composition=None):
    """
    LPG pool value from its components, volume weighted.

    The stream is C3 + iC4 + nC4. Alberta prices C3 and C4 separately, so
    the pool is weighted rather than represented by propane alone.
    """
    comp = composition or LPG_COMPOSITION
    if propane_cad_m3 is None or butanes_cad_m3 is None:
        return None
    return (comp["propane_cad_m3"] * float(propane_cad_m3)
            + comp["butanes_cad_m3"] * float(butanes_cad_m3))


def build_ngl_prices(alberta, driver_month_averages, driver_today,
                     composition=None):
    """
    Today's naphtha and LPG values from an Alberta anchor set.

    alberta               : the "value" dict from fetch_alberta_ngl_prices
    driver_month_averages : {series_key: average over the anchor month}
    driver_today          : {series_key: today's spot}

    Returns {"naphtha": {...}, "lpg": {...}} with the arithmetic exposed:
    every entry carries its anchor, factor, driver and result so the number
    can be checked by hand.
    """
    if not alberta:
        return {}
    out, legs = {}, {}
    for key in ALBERTA_NGL_LINES:
        series, driver_label = ANCHOR_DRIVERS[key]
        anchor = alberta.get(key)
        month_avg = (driver_month_averages or {}).get(series)
        today = (driver_today or {}).get(series)
        k = calibrate_factor(anchor, month_avg)
        legs[key] = {
            "anchor_cad_m3": anchor,
            "driver_series": series,
            "driver_label": driver_label,
            "driver_month_average": month_avg,
            "driver_today": today,
            "factor_k": k,
            "movement": (today / month_avg if month_avg and today else None),
            "price_cad_m3": (k * today if k is not None and today is not None
                             else None),
        }

    out["naphtha"] = dict(legs["pentanes_plus_cad_m3"])
    out["naphtha"]["basis"] = "Alberta Pentanes Plus Spec"

    lpg_price = blend_lpg(legs["propane_cad_m3"]["price_cad_m3"],
                          legs["butanes_cad_m3"]["price_cad_m3"], composition)
    comp = composition or LPG_COMPOSITION
    out["lpg"] = {
        "price_cad_m3": lpg_price,
        "basis": "Alberta Propane Spec and Butanes Spec, volume weighted",
        "components": {"propane": legs["propane_cad_m3"],
                       "butanes": legs["butanes_cad_m3"]},
        "composition": dict(comp),
    }
    return out


# =============================================================================
# 5. SELF-TEST
# =============================================================================

if __name__ == "__main__":
    print("Alberta NGL reference price anchoring - self-test")
    print("=" * 70)

    live = fetch_alberta_ngl_prices()
    print(f"\n  fetch ok={live['ok']} source={live['source']} "
          f"month={live['detail'].get('anchor_month')}")
    values = live["value"] or {"propane_cad_m3": 173.00,
                               "butanes_cad_m3": 231.64,
                               "pentanes_plus_cad_m3": 709.05}
    for key, label in ALBERTA_NGL_LINES.items():
        print(f"    {label:38s} {values[key]:8.2f} C$/m3")

    # Live drivers where a key is available, otherwise the last verified set.
    key = None
    try:
        import engine
        key = engine.get_secret("EIA_API_KEY")
    except Exception:
        pass
    anchor_month = live["detail"].get("anchor_month") or "2026-06"
    drivers = fetch_drivers(anchor_month, key) if key else None
    if drivers and all(drivers["today"].values()):
        month_avg, today = drivers["month_averages"], drivers["today"]
        print(f"\n  drivers live from EIA, anchor month {anchor_month}")
        for series, d in drivers["detail"].items():
            print(f"    {series:18s} month avg {d['month_average']['value']:.4f} "
                  f"over {d['month_average']['observations']} days, "
                  f"today {d['today']['value']:.4f} on {d['today']['date']}")
    else:
        month_avg = {"gasoline_usd_gal": 3.0119, "propane_usd_gal": 0.7551}
        today = {"gasoline_usd_gal": 3.318, "propane_usd_gal": 0.723}
        print("\n  drivers from stored values, no EIA key")
    built = build_ngl_prices(values, month_avg, today)

    print("\n  Naphtha")
    n = built["naphtha"]
    print(f"    k = {n['anchor_cad_m3']:.2f} / {n['driver_month_average']:.4f} "
          f"= {n['factor_k']:.2f}")
    print(f"    price = {n['factor_k']:.2f} x {n['driver_today']:.4f} "
          f"= {n['price_cad_m3']:.2f} C$/m3")

    print("\n  LPG")
    for name, leg in built["lpg"]["components"].items():
        print(f"    {name:8s} {leg['anchor_cad_m3']:7.2f} x "
              f"{leg['movement']:.4f} = {leg['price_cad_m3']:7.2f} C$/m3   "
              f"({leg['driver_label']})")
    c = built["lpg"]["composition"]
    print(f"    pool  = {c['propane_cad_m3']:.3f} x C3 + "
          f"{c['butanes_cad_m3']:.3f} x C4 = "
          f"{built['lpg']['price_cad_m3']:.2f} C$/m3")

    print("\n  Guard: a ratio carries no FX")
    print(f"    movement {n['movement']:.4f} is dimensionless, so the anchor "
          f"stays in C$/m3")
