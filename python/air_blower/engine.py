"""
Air Blower — Performance & Health Calculation Engine
Version: 1.0
Date: 2026-04-04

Engineering calculation engine for a dual-train centrifugal air blower
(Blowers A / B, one active at a time). The same calculation methods are
implemented by the Ferriq TypeScript site model.

Usage:
    from engine import process_single_row, process_batch, load_csv
    result = process_batch(load_csv("reference/blower-demo.csv"))

Contract:
    - Row dicts accept both snake_case engine names and the original human-
      readable CSV headers (e.g. "Motor Current A").
    - Missing critical tags cause the row to be dropped (reason recorded).
    - Efficiency results are NOT clamped. A computed 140 % is a data-quality
      signal, not something to hide.
"""

import math
import csv
from datetime import datetime

# =============================================================================
# 1. CONFIGURATION  (override by passing dicts into process_single_row)
# =============================================================================

DEFAULT_SETTINGS = {
    # Engineering parameters
    "motor_voltage_v": 4000.0,      # 3-phase line-to-line, from motor datasheet
    "power_factor": 0.85,           # used only when power_factor_mode="fixed"
    "power_factor_mode": "datasheet",
    "gamma_k": 1.40,                # isentropic exponent for air (ASHRAE Handbook)
    "atm_pressure_bar": 0.93,       # site atmospheric pressure, ~93 kPa
    # Data-quality rules
    "active_current_min_a": 10.0,   # below this, blower treated as off
    "suction_temp_fallback_c": 4.0, # retained for compatibility; no fixed value is inserted
    "suction_temp_ff_max_hours": 4, # forward-fill window (batch mode only)
    "baseline_training_days": 14.0,
    "performance_bypass_max_pct": 5.0,
    # Blower mode: "auto" | "A" | "B"
    "blower_mode": "auto",
    # Efficiency method to report as the headline KPI:
    # "polytropic" | "isentropic" | "fluid"
    "efficiency_method": "polytropic",
}

# Tiered alert limits. Sources cited per-field.
DEFAULT_LIMITS = {
    # Vibration (ISO 10816-3, Group 1: large machines >300 kW, rigid foundation,
    # measured in mm/s RMS on non-rotating parts)
    "vib_advisory_mms": 4.5,        # Zone B/C boundary
    "vib_alarm_mms":    7.1,        # Zone C/D boundary
    "vib_trip_mms":     11.0,       # Zone D (long operation not permissible)
    # Bearing temperature (manufacturer-typical for oil-lubed journal bearings)
    "brg_advisory_c":   70.0,
    "brg_alarm_c":      85.0,
    "brg_trip_c":       95.0,
    # Process advisories (plant-specific; user-tunable)
    "filter_dp_max_bar":   0.10,
    "blower_dp_max_bar":   1.00,
    "bypass_open_max_pct": 60.0,
    "performance_watch_pct": 5.0,
    "performance_alarm_pct": 10.0,
    "thrust_proxy_watch_pct": 15.0,
    "thrust_proxy_alarm_pct": 25.0,
}

BLOWER_DESIGN_REFERENCE = {
    "inlet_pressure_kpaa": 93.0,
    "discharge_pressure_kpaa": 178.0,
    "annual_average_inlet_temp_c": 4.0,
    "design_flow_nm3hr": 23187.0,
    "design_train_power_kw": 711.0,
    "design_polytropic_efficiency_pct": 76.0,
    "design_speed_rpm": 3580.0,
}

MOTOR_POWER_FACTOR_POINTS = [
    (33.1, 0.055),
    (51.1, 0.701),
    (82.5, 0.853),
    (118.7, 0.889),
    (157.5, 0.896),
]

# =============================================================================
# 2. INTEGRATION HOOK  (for the live-historian implementer)
# =============================================================================
# The engine reads plain dicts. Whoever wires this to Aveva PI / OPC-UA / SQL
# should produce the same dict shape at the historian boundary. Example:
#
#   def fetch_historian(tag_map, start, end, interval_s):
#       # tag_map: {"motor_current_a": "1645-IT-A01.PV", ...}
#       import requests
#       resp = requests.get(PI_WEB_API + "/streamsets/recorded", params={...})
#       # Transpose the response into one dict per timestamp, keyed by the
#       # engine variable names (snake_case), NOT the historian tag names.
#       return rows
#
# The mapping from historian tag -> engine variable happens at this boundary.
# Nothing downstream needs to know the plant's tag prefixes.
# =============================================================================

# =============================================================================
# 3. INPUT MAPPING  (accept snake_case or original CSV headers)
# =============================================================================

# canonical engine name -> list of accepted aliases in input rows
TAG_ALIASES = {
    "timestamp":               ["timestamp", "Timestamp", "Date", "date", "Time"],
    "motor_current_a":         ["motor_current_a", "Motor Current A"],
    "motor_current_b":         ["motor_current_b", "Motor Current B"],
    "suction_pressure_a":      ["suction_pressure_a", "Suction Press A"],
    "suction_pressure_b":      ["suction_pressure_b", "Suction Press B"],
    "discharge_pressure_a":    ["discharge_pressure_a", "Discharge Press A"],
    "discharge_pressure_b":    ["discharge_pressure_b", "Discharge Press B"],
    "controller_sp_a":         ["controller_sp_a", "Controller SP A"],
    "controller_sp_b":         ["controller_sp_b", "Controller SP B"],
    "bypass_op_a":             ["bypass_op_a", "Bypass OP A"],
    "bypass_op_b":             ["bypass_op_b", "Bypass OP B"],
    "filter_dp_a":             ["filter_dp_a", "Filter DP A"],
    "filter_dp_b":             ["filter_dp_b", "Filter DP B"],
    "total_flow":              ["total_flow", "Total Flow"],
    "suction_temp":            ["suction_temp", "Suction Temp"],
    "discharge_temp_a":        ["discharge_temp_a", "Discharge Temp A"],
    "discharge_temp_b":        ["discharge_temp_b", "Discharge Temp B"],
    # Vibration probes A1..A4, B1..B4
    "vibration_a_1":           ["vibration_a_1", "Vibration A1"],
    "vibration_a_2":           ["vibration_a_2", "Vibration A2"],
    "vibration_a_3":           ["vibration_a_3", "Vibration A3"],
    "vibration_a_4":           ["vibration_a_4", "Vibration A4"],
    "vibration_b_1":           ["vibration_b_1", "Vibration B1"],
    "vibration_b_2":           ["vibration_b_2", "Vibration B2"],
    "vibration_b_3":           ["vibration_b_3", "Vibration B3"],
    "vibration_b_4":           ["vibration_b_4", "Vibration B4"],
    # Bearing temps A1, A2, B1, B2
    "bearing_temp_a_1":        ["bearing_temp_a_1", "Bearing Temp A1"],
    "bearing_temp_a_2":        ["bearing_temp_a_2", "Bearing Temp A2"],
    "bearing_temp_b_1":        ["bearing_temp_b_1", "Bearing Temp B1"],
    "bearing_temp_b_2":        ["bearing_temp_b_2", "Bearing Temp B2"],
}


def _lookup(row, canonical):
    """Return the first populated alias value for a canonical tag name."""
    for alias in TAG_ALIASES.get(canonical, [canonical]):
        if alias in row and row[alias] not in (None, "", " "):
            return row[alias]
    return None


def _num(val):
    """Safe numeric parse. NaN on blank/invalid."""
    if val is None or val == "":
        return float("nan")
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(",", "").strip())
    except ValueError:
        return float("nan")


def _parse_ts(ts):
    if isinstance(ts, datetime):
        return ts
    if ts is None:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
                "%m/%d/%Y %H:%M", "%m-%d-%y %H:%M",
                "%d/%m/%Y %H:%M", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(str(ts).strip(), fmt)
        except ValueError:
            continue
    return None


# =============================================================================
# 4. CORE MATH  (each function cites its source)
# =============================================================================

def shaft_power_kw(voltage_v, current_a, power_factor):
    """
    Electrical input power to a 3-phase induction motor.
      P = sqrt(3) * V * I * PF / 1000   [kW]
    Ref: standard 3-phase power equation (IEEE/NEMA motor basics).
    """
    return math.sqrt(3.0) * voltage_v * current_a * power_factor / 1000.0


def motor_power_factor_from_current(current_a):
    pts = MOTOR_POWER_FACTOR_POINTS
    if not math.isfinite(current_a):
        return float("nan")
    if current_a <= pts[0][0]:
        return pts[0][1]
    if current_a >= pts[-1][0]:
        return pts[-1][1]
    for i in range(1, len(pts)):
        if current_a <= pts[i][0]:
            lo, hi = pts[i - 1], pts[i]
            frac = (current_a - lo[0]) / (hi[0] - lo[0])
            return lo[1] + frac * (hi[1] - lo[1])
    return pts[-1][1]


def thrust_operating_deviation_pct(flow_nm3hr, pressure_ratio, bypass_pct):
    design_pr = (
        BLOWER_DESIGN_REFERENCE["discharge_pressure_kpaa"]
        / BLOWER_DESIGN_REFERENCE["inlet_pressure_kpaa"]
    )
    dq = (
        (flow_nm3hr - BLOWER_DESIGN_REFERENCE["design_flow_nm3hr"])
        / BLOWER_DESIGN_REFERENCE["design_flow_nm3hr"]
    )
    dpr = (pressure_ratio - design_pr) / design_pr
    recycle = max(0.0, bypass_pct) / 100.0
    return math.sqrt((dq * dq + dpr * dpr + recycle * recycle) / 3.0) * 100.0


def normalize_pressures(p_suction_kpaa, p_discharge_kpag, p_atm_bar):
    """
    Convert the mixed-unit plant measurements to absolute bar.
      P1 = P_suction_kpaa / 100                  [bar absolute]
      P2 = P_discharge_kpag / 100 + P_atm_bar    [bar absolute]
    """
    p1_bar = p_suction_kpaa / 100.0
    p2_bar = p_discharge_kpag / 100.0 + p_atm_bar
    return p1_bar, p2_bar


def fluid_power_kw(flow_nm3hr, dp_bar):
    """
    Indicator-grade hydraulic power. Valid for incompressible flow; used as
    a trending indicator for gas blowers, NOT a thermodynamic efficiency.
      P_fluid = Q * dP / 36             [kW]
    Derivation of 36:
      (Nm^3/hr * bar) * (1e5 Pa/bar) / (3600 s/hr * 1e3 W/kW) = 1/36
    """
    return flow_nm3hr * dp_bar / 36.0


def isentropic_efficiency(t1_k, t2_k, p1_bar, p2_bar, k):
    """
    Isentropic (adiabatic) efficiency for a compressor.
    Ideal-gas POC estimate; ASME PTC 10 is the compressor-performance test framework.
      eta_s = T1 * [(P2/P1)^((k-1)/k) - 1] / (T2 - T1)

    Returns decimal (0.75 = 75 %), or NaN if inputs are infeasible.
    """
    if not (p2_bar > p1_bar and t2_k > t1_k):
        return float("nan")
    exponent = (k - 1.0) / k
    ideal_dt = t1_k * (math.pow(p2_bar / p1_bar, exponent) - 1.0)
    actual_dt = t2_k - t1_k
    return ideal_dt / actual_dt


def polytropic_efficiency(t1_k, t2_k, p1_bar, p2_bar, k):
    """
    Polytropic efficiency for a compressor.
    Ideal-gas POC estimate; ASME PTC 10 is the compressor-performance test framework.

    Using the polytropic temperature exponent:
      sigma = (n-1)/n = ln(T2/T1) / ln(P2/P1)
      eta_p = ((k-1)/k) / sigma

    Industry-standard efficiency metric for centrifugal machines. Always
    >= isentropic efficiency for a compressor.

    Returns decimal, or NaN if inputs are infeasible.
    """
    if not (p2_bar > p1_bar and t2_k > t1_k):
        return float("nan")
    sigma = math.log(t2_k / t1_k) / math.log(p2_bar / p1_bar)
    if sigma <= 0:
        return float("nan")
    return ((k - 1.0) / k) / sigma


# =============================================================================
# 5. ACTIVE-BLOWER DETECTION
# =============================================================================

def detect_active_blower(curr_a, curr_b, mode, min_a):
    """
    Return 'A', 'B', or None. None = no blower running.
    mode='auto': train with current > min_a wins; higher current tiebreaker.
    mode='A'|'B': forced selection (returns None if that current < min_a).
    """
    if mode == "A":
        return "A" if (not math.isnan(curr_a) and curr_a > min_a) else None
    if mode == "B":
        return "B" if (not math.isnan(curr_b) and curr_b > min_a) else None
    a_on = not math.isnan(curr_a) and curr_a > min_a
    b_on = not math.isnan(curr_b) and curr_b > min_a
    if a_on and b_on:
        return "A" if curr_a >= curr_b else "B"
    if a_on: return "A"
    if b_on: return "B"
    return None


# =============================================================================
# 6. ALERT ENGINE
# =============================================================================

def _alert(severity, message, source):
    return {"severity": severity, "message": message, "source": source}


def build_alerts(vib_max, brg_max, filter_dp, dp_bar, bypass_op,
                 p_discharge_kpag, controller_sp, lim):
    """Return a list of active alerts (unordered; status is rolled up separately)."""
    a = []
    ISO = "ISO 10816-3, Group 1 (large machines, rigid foundation)"

    # Vibration (tiered)
    if not math.isnan(vib_max):
        if vib_max >= lim["vib_trip_mms"]:
            a.append(_alert("trip",
                f"Vibration {vib_max:.2f} mm/s exceeds trip limit "
                f"{lim['vib_trip_mms']} mm/s (ISO 10816 Zone D).", ISO))
        elif vib_max >= lim["vib_alarm_mms"]:
            a.append(_alert("alarm",
                f"Vibration {vib_max:.2f} mm/s exceeds alarm limit "
                f"{lim['vib_alarm_mms']} mm/s (ISO 10816 Zone C/D).", ISO))
        elif vib_max >= lim["vib_advisory_mms"]:
            a.append(_alert("advisory",
                f"Vibration {vib_max:.2f} mm/s above advisory "
                f"{lim['vib_advisory_mms']} mm/s (ISO 10816 Zone B/C).", ISO))

    # Bearing temperature (tiered)
    if not math.isnan(brg_max):
        if brg_max >= lim["brg_trip_c"]:
            a.append(_alert("trip",
                f"Bearing temperature {brg_max:.1f} C exceeds trip limit "
                f"{lim['brg_trip_c']} C.", "bearing datasheet"))
        elif brg_max >= lim["brg_alarm_c"]:
            a.append(_alert("alarm",
                f"Bearing temperature {brg_max:.1f} C exceeds alarm limit "
                f"{lim['brg_alarm_c']} C.", "bearing datasheet"))
        elif brg_max >= lim["brg_advisory_c"]:
            a.append(_alert("advisory",
                f"Bearing temperature {brg_max:.1f} C above advisory "
                f"{lim['brg_advisory_c']} C.", "bearing datasheet"))

    # Process advisories
    if not math.isnan(filter_dp) and filter_dp > lim["filter_dp_max_bar"]:
        a.append(_alert("advisory",
            f"Filter dP {filter_dp:.3f} bar above {lim['filter_dp_max_bar']} bar "
            f"- replace filter.", "plant setpoint"))
    if not math.isnan(dp_bar) and dp_bar > lim["blower_dp_max_bar"]:
        a.append(_alert("advisory",
            f"Blower dP {dp_bar:.3f} bar above design {lim['blower_dp_max_bar']} bar "
            f"- possible internal fouling.", "plant setpoint"))
    if not math.isnan(bypass_op) and bypass_op > lim["bypass_open_max_pct"]:
        a.append(_alert("advisory",
            f"Bypass valve {bypass_op:.1f}% above {lim['bypass_open_max_pct']}% "
            f"- recycling excess flow.", "plant setpoint"))
    if (not math.isnan(bypass_op) and bypass_op < 5.0
            and not math.isnan(p_discharge_kpag) and not math.isnan(controller_sp)
            and p_discharge_kpag < controller_sp):
        a.append(_alert("advisory",
            "Bypass closed and discharge pressure below setpoint - "
            "machine at capacity limit.", "control narrative"))

    return a


def roll_up_status(alerts):
    if any(x["severity"] == "trip" for x in alerts):     return "trip"
    if any(x["severity"] == "alarm" for x in alerts):    return "alarm"
    if any(x["severity"] == "advisory" for x in alerts): return "advisory"
    return "ok"


# =============================================================================
# 7. SINGLE-ROW PROCESSOR
# =============================================================================

def process_single_row(row, settings=None, limits=None):
    """
    Process one timestamped row of blower tags.
    Returns a dict of KPIs + alerts + status, or {"drop": True, "reason": ...}.
    """
    s   = {**DEFAULT_SETTINGS, **(settings or {})}
    lim = {**DEFAULT_LIMITS, **(limits or {})}

    ts = _parse_ts(_lookup(row, "timestamp"))
    if ts is None:
        return {"drop": True, "reason": "unparseable timestamp"}

    curr_a = _num(_lookup(row, "motor_current_a"))
    curr_b = _num(_lookup(row, "motor_current_b"))
    active = detect_active_blower(curr_a, curr_b, s["blower_mode"],
                                  s["active_current_min_a"])
    if active is None:
        return {"drop": True, "reason": "no active blower (both currents < min)"}

    a_lower = active.lower()
    current = curr_a if active == "A" else curr_b
    p1_kpaa = _num(_lookup(row, f"suction_pressure_{a_lower}"))
    p2_kpag = _num(_lookup(row, f"discharge_pressure_{a_lower}"))
    sp_kpag = _num(_lookup(row, f"controller_sp_{a_lower}"))
    bypass  = _num(_lookup(row, f"bypass_op_{a_lower}"))
    filt_dp = _num(_lookup(row, f"filter_dp_{a_lower}"))
    t2_c    = _num(_lookup(row, f"discharge_temp_{a_lower}"))
    flow    = _num(_lookup(row, "total_flow"))
    t1_c    = _num(_lookup(row, "suction_temp"))

    if any(math.isnan(x) for x in (p1_kpaa, p2_kpag, flow, current)):
        return {"drop": True, "reason": "missing critical tag (P1, P2, flow, or current)"}

    # Vibrations + bearing temps
    vib_vals = [_num(_lookup(row, f"vibration_{a_lower}_{i}")) for i in (1,2,3,4)]
    vib_vals = [v for v in vib_vals if not math.isnan(v)]
    vib_max  = max(vib_vals) if vib_vals else float("nan")

    brg_vals = [_num(_lookup(row, f"bearing_temp_{a_lower}_{i}")) for i in (1,2)]
    brg_vals = [v for v in brg_vals if not math.isnan(v)]
    brg_max  = max(brg_vals) if brg_vals else float("nan")

    # T1 fallback: batch mode injects "_t1_forward_filled" if recent value exists
    if math.isnan(t1_c):
        if "_t1_forward_filled" in s:
            t1_c = s["_t1_forward_filled"]
            t1_source = "forward-filled"
        else:
            t1_source = "unavailable"
    else:
        t1_source = "measured"

    # Math
    p_elec = shaft_power_kw(s["motor_voltage_v"], current, s["power_factor"])
    p1_bar, p2_bar = normalize_pressures(p1_kpaa, p2_kpag, s["atm_pressure_bar"])
    dp_bar = p2_bar - p1_bar
    p_ratio = p2_bar / p1_bar if p1_bar > 0 else float("nan")

    p_fluid = fluid_power_kw(flow, dp_bar)
    eff_fluid = (p_fluid / p_elec * 100.0) if p_elec > 0 else float("nan")

    t1_k = t1_c + 273.15 if not math.isnan(t1_c) else float("nan")
    t2_k = t2_c + 273.15 if not math.isnan(t2_c) else float("nan")
    eff_isen = (isentropic_efficiency(t1_k, t2_k, p1_bar, p2_bar, s["gamma_k"]) * 100.0
                if not math.isnan(t1_k) and not math.isnan(t2_k) else float("nan"))
    eff_poly = (polytropic_efficiency(t1_k, t2_k, p1_bar, p2_bar, s["gamma_k"]) * 100.0
                if not math.isnan(t1_k) and not math.isnan(t2_k) else float("nan"))

    method = s["efficiency_method"]
    eff_headline = {"polytropic": eff_poly, "isentropic": eff_isen,
                    "fluid": eff_fluid}.get(method, eff_poly)
    method_used = method
    if math.isnan(eff_headline) and method != "fluid":
        eff_headline = eff_fluid
        method_used = f"{method} (fallback to fluid)"

    alerts = build_alerts(vib_max, brg_max, filt_dp, dp_bar, bypass,
                          p2_kpag, sp_kpag, lim)
    status = roll_up_status(alerts)

    def _r(v, d=2):
        # Preserve calculation precision; presentation layers decide display rounding.
        return None if math.isnan(v) else v

    return {
        "drop": False,
        "timestamp": ts.isoformat(),
        "active_blower": active,
        "power_kw":              _r(p_elec, 2),
        "pressure_ratio":        _r(p_ratio, 4),
        "dp_bar":                _r(dp_bar, 4),
        "p1_bar_abs":            _r(p1_bar, 4),
        "p2_bar_abs":            _r(p2_bar, 4),
        "flow_nm3hr":            _r(flow, 1),
        "fluid_power_kw":        _r(p_fluid, 2),
        "efficiency_fluid_pct":       _r(eff_fluid, 2),
        "efficiency_isentropic_pct":  _r(eff_isen, 2),
        "efficiency_polytropic_pct":  _r(eff_poly, 2),
        "efficiency_headline_pct":    _r(eff_headline, 2),
        "efficiency_method": method,
        "efficiency_method_used": method_used,
        "active_current_amp": _r(current, 3),
        "max_vibration_mms":     _r(vib_max, 2),
        "max_bearing_temp_c":    _r(brg_max, 1),
        "filter_dp_bar":         _r(filt_dp, 3),
        "bypass_op_pct":         _r(bypass, 1),
        "t1_c_used": None if math.isnan(t1_c) else t1_c,
        "t1_source": t1_source,
        "thrust_proxy_pct": _r(thrust_proxy_pct, 2),
        "alerts": alerts,
        "status": status,
    }


def fit_simple_flow_model(points):
    """Fit an interpretable baseline linear regression: flow = a + b*current."""
    clean = [(float(x), float(y)) for x, y in points
             if x is not None and y is not None and math.isfinite(float(x)) and math.isfinite(float(y))]
    if len(clean) < 5:
        return None
    mx = sum(x for x, _ in clean) / len(clean)
    my = sum(y for _, y in clean) / len(clean)
    variance = sum((x - mx) ** 2 for x, _ in clean)
    covariance = sum((x - mx) * (y - my) for x, y in clean)
    slope = covariance / variance if variance > 1e-12 else 0.0
    return {"intercept": my - slope * mx, "slope": slope, "training_rows": len(clean)}


def predict_flow_nm3hr(model, current):
    if model is None or current is None or not math.isfinite(float(current)):
        return None
    return model["intercept"] + model["slope"] * float(current)


def _trend_per_day(history):
    """Least-squares slope for (datetime, value) pairs."""
    if len(history) < 3:
        return None
    t0 = history[0][0]
    xs = [(t - t0).total_seconds() / 86400.0 for t, _ in history]
    ys = [v for _, v in history]
    mx = sum(xs) / len(xs)
    my = sum(ys) / len(ys)
    denom = sum((x - mx) ** 2 for x in xs)
    if denom <= 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom


# =============================================================================
# 8. BATCH PROCESSOR  (bounded forward-fill on suction temp)
# =============================================================================

def process_batch(rows, settings=None, limits=None):
    """
    Process many rows in timestamp order. Implements bounded forward-fill
    on suction_temp per STANDARD.md §4.
    """
    s = {**DEFAULT_SETTINGS, **(settings or {})}
    lim = {**DEFAULT_LIMITS, **(limits or {})}
    ff_window_h = s["suction_temp_ff_max_hours"]

    sortable = []
    for r in rows:
        ts = _parse_ts(_lookup(r, "timestamp"))
        if ts is not None:
            sortable.append((ts, r))
    sortable.sort(key=lambda x: x[0])

    last_t1_val, last_t1_ts = None, None
    processed, dropped, reasons = [], 0, {}

    for ts, r in sortable:
        live_t1 = _num(_lookup(r, "suction_temp"))
        row_settings = dict(s)
        if math.isnan(live_t1) and last_t1_val is not None:
            age_h = (ts - last_t1_ts).total_seconds() / 3600.0
            if age_h <= ff_window_h:
                row_settings["_t1_forward_filled"] = last_t1_val

        out = process_single_row(r, row_settings, limits)
        if out.get("drop"):
            dropped += 1
            reasons[out["reason"]] = reasons.get(out["reason"], 0) + 1
        else:
            processed.append(out)
            if out["t1_source"] == "measured":
                last_t1_val = out["t1_c_used"]
                last_t1_ts = ts

    # Standard, transparent ML baseline: train a separate current->flow
    # regression for each blower using the first 14 clean-reference rows.
    for train in ("A", "B"):
        eligible = [r for r in processed
                    if r["active_blower"] == train
                    and r.get("active_current_amp") is not None
                    and r.get("flow_nm3hr") is not None
                    and (r.get("bypass_op_pct") is None or r["bypass_op_pct"] < s["performance_bypass_max_pct"])
                    and (r.get("filter_dp_bar") is None or r["filter_dp_bar"] <= lim["filter_dp_max_bar"])]
        if eligible:
            training_start = datetime.fromisoformat(eligible[0]["timestamp"])
            training_end = training_start.timestamp() + s["baseline_training_days"] * 86400.0
            training_rows = [
                r for r in eligible
                if datetime.fromisoformat(r["timestamp"]).timestamp() <= training_end
            ]
        else:
            training_rows = []
        model = fit_simple_flow_model(
            [(r["active_current_amp"], r["flow_nm3hr"]) for r in training_rows]
        )
        for r in [x for x in processed if x["active_blower"] == train]:
            expected = predict_flow_nm3hr(model, r.get("active_current_amp"))
            within_baseline_envelope = (
                (r.get("bypass_op_pct") is None or r["bypass_op_pct"] < s["performance_bypass_max_pct"])
                and (r.get("filter_dp_bar") is None or r["filter_dp_bar"] <= lim["filter_dp_max_bar"])
            )
            residual = ((r["flow_nm3hr"] - expected) / expected * 100.0
                        if within_baseline_envelope and expected is not None and expected > 0 else None)
            r["expected_flow_nm3hr"] = expected
            r["flow_residual_pct"] = residual
            r["performance_degradation_pct"] = None if residual is None else max(0.0, -residual)
            r["performance_model_training_rows"] = 0 if model is None else model["training_rows"]
            r["performance_model_applicable"] = bool(within_baseline_envelope and model is not None)
            if residual is not None and residual <= -lim.get("performance_alarm_pct", 10.0):
                r["alerts"].append(_alert("alarm",
                    f"Measured flow is {abs(residual):.1f}% below the baseline regression expectation.",
                    "healthy-baseline linear regression"))
            elif residual is not None and residual <= -lim.get("performance_watch_pct", 5.0):
                r["alerts"].append(_alert("advisory",
                    f"Measured flow is {abs(residual):.1f}% below the baseline regression expectation.",
                    "healthy-baseline linear regression"))
            r["status"] = roll_up_status(r["alerts"])

    # Trend-only bearing/vibration projections. These are not remaining-life estimates.
    for i, r in enumerate(processed):
        for metric, output in (("max_bearing_temp_c", "bearing_trend_c_per_day"),
                               ("max_vibration_mms", "vibration_trend_mms_per_day")):
            hist = []
            for x in processed[max(0, i-6):i+1]:
                v = x.get(metric)
                if v is not None and math.isfinite(float(v)):
                    hist.append((datetime.fromisoformat(x["timestamp"]), float(v)))
            slope = _trend_per_day(hist)
            r[output] = slope
        bearing = r.get("max_bearing_temp_c")
        slope = r.get("bearing_trend_c_per_day")
        if bearing is not None and slope is not None and slope > 0 and bearing < lim["brg_advisory_c"]:
            r["bearing_advisory_eta_days"] = (lim["brg_advisory_c"] - bearing) / slope
        else:
            r["bearing_advisory_eta_days"] = None
        r["thrust_health"] = "unavailable"

    return {
        "rows_processed": len(processed),
        "rows_dropped": dropped,
        "drop_reasons": reasons,
        "results": processed,
    }


# =============================================================================
# 9. CSV LOADER
# =============================================================================

def load_csv(path):
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))
    except Exception as e:
        print(f"[engine] CSV load error: {e}")
        return []


# =============================================================================
# 10. CLI RUNNER
# =============================================================================

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "reference/blower-demo.csv"
    batch = process_batch(load_csv(path))
    print(f"Processed: {batch['rows_processed']}  Dropped: {batch['rows_dropped']}")
    if batch["drop_reasons"]:
        print("Drop reasons:")
        for r, c in batch["drop_reasons"].items():
            print(f"  - {r}: {c}")
    if batch["results"]:
        latest = batch["results"][-1]
        print(f"\nLatest row: {latest['timestamp']}  Blower {latest['active_blower']}")
        print(f"  Power:            {latest['power_kw']} kW")
        print(f"  Pressure ratio:   {latest['pressure_ratio']}")
        print(f"  eta fluid:        {latest['efficiency_fluid_pct']} %")
        print(f"  eta isentropic:   {latest['efficiency_isentropic_pct']} %")
        print(f"  eta polytropic:   {latest['efficiency_polytropic_pct']} %")
        print(f"  Max vibration:    {latest['max_vibration_mms']} mm/s")
        print(f"  Max bearing T:    {latest['max_bearing_temp_c']} C")
        print(f"  Status:           {latest['status'].upper()}")
        for a in latest["alerts"]:
            print(f"    [{a['severity'].upper()}] {a['message']}")