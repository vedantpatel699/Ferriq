"""fired-heater: standalone calculation file.
Run with Python 3.10 or newer (IDLE: Run > Run Module, or python fired_heater_engine.py).
No installation packages, network connection or other files are required.
Edit SETTINGS below to change configuration. With no arguments, a simulated
example runs and saves fired_heater_results.json beside this file.
Optional: python fired_heater_engine.py input.json > output.json
The common schema is provisional; live AVEVA integration remains unverified.
"""
import base64, gzip, json, io
from pathlib import Path
from zoneinfo import ZoneInfo as _ZoneInfo

def ZoneInfo(key):
    if key == "America/Edmonton":
        return _ZoneInfo.from_file(io.BytesIO(base64.b64decode('VFppZjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAVFppZjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAABgAAABj/////iN7O4P////+euK+Q/////5+7B4D/////oJiRkP////+g0oWA/////6KK6JD/////o4QGAP////+kasqQ/////6U1w4D/////plPnEP////+nFaWA/////6gzyRD/////qP7CAP/////LiQyQ/////9Ij9HD/////0mEYAP/////VVeMQ/////9Yg3AAAAAAABGEZkAAAAAAFUPyAAAAAAAZA+5AAAAAABzDegAAAAAAIIN2QAAAAAAkQwIAAAAAACgC/kAAAAAAK8KKAAAAAAAvgoZAAAAAADNm/AAAAAAANwIOQAAAAAA65oQAAAAAAD6mgEAAAAAAQmYMAAAAAABGJghAAAAAAEnllAAAAAAATaWQQAAAAABRZRwAAAAAAFUlGEAAAAAAWOSkAAAAAABcpKBAAAAAAGCJFgAAAAAAZCQoQAAAAABoCJ4AAAAAAGvImkAAAAAAb4gmAAAAAABzSCJAAAAAAHcHrgAAAAAAeseqQAAAAAB+hzYAAAAAAIHYdEAAAAAAhga+AAAAAACJV/xAAAAAAI2rMAAAAAAAkNeEQAAAAACVKrgAAAAAAJhXDEAAAAAAnKpAAAAAAACf+35AAAAAAKQpyAAAAAAAp3sGQAAAAACrqVAAAAAAAK76jkAAAAAAs03CAAAAAAC2ehZAAAAAALrNSgAAAAAAvfmeQAAAAADCTNIAAAAAAMWeEEAAAAAAycxaAAAAAADNHZhAAAAAANFL4gAAAAAA1J0gQAAAAADYy2oAAAAAANwcqEAAAAAA4G/cAAAAAADjnDBAAAAAAOfvZAAAAAAA6xu4QAAAAADvbuwAAAAAAPLAKkAAAAAA9u50AAAAAAD6P7JAAAAAAP5t/AAAAAABAb86QAAAAAEGEm4AAAAAAQk+wkAAAAABDZH2AAAAAAEQvkpAAAAAARURfgAAAAABF88UQAAAAAEctfAAAAAAAR9OnEAAAAABJDV4AAAAAAEmziRAAAAAASu1AAAAAAABLnKWQAAAAAEzWXIAAAAAATXyHkAAAAABOtj6AAAAAAE9caZAAAAAAUJYggAAAAABRPEuQAAAAAFJ2AoAAAAAAUxwtkAAAAABUVeSAAAAAAFT8D5AAAAAAVjXGgAAAAABW5SwQAAAAAFge4wAAAAAAWMUOEAAAAABZ/sUAAAAAAFqk8BAAAAAAW96nAAAAAABchNIQAAAAAF2+iQAAAAAAXmS0EAAAAABfnmsAAAAAAGBN0JAAAAAAYYeHgAAAAABiLbKQAAAAAGNnaYAAAAAAZA2UkAAAAABlR0uAAAAAAGXtdpAAAAAAZyctgAAAAABnzViQAAAAAGkHD4AAAAAAaa06kAAAAABq5vGAAgECAQIBAgECAQIBAgMEAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQIBAgECAQX//5WgAAD//6ugAQT//52QAAj//6ugAQz//6ugARD//6ugABRMTVQATURUAE1TVABNV1QATVBUAENTVAAKQ1NUNgo=')), key=key)
    return _ZoneInfo(key)

def _unpack(text):
    return json.loads(gzip.decompress(base64.b64decode(text)))

# USER SETTINGS: defaults are the same as the website. Edit these values.
SETTINGS = {'fuelCase': 'Sheet Reference Case (83.64%)',
 'radiationLossPct': 1.5,
 'unaccountedLossPct': 0.5,
 'refTempC': 15,
 'designDutyKw': 42140,
 'designEffPct': 83.3,
 'designStackC': 294,
 'designO2Pct': 4.27,
 'designFuelKgS': 0.849,
 'designBwC': 778,
 'effAdvisoryPct': 82,
 'effAlarmPct': 78,
 'stackAdvisoryC': 320,
 'stackAlarmC': 360,
 'bwAdvisoryC': 830,
 'bwAlarmC': 870,
 'eaAdvisoryPct': 30,
 'eaAlarmPct': 45,
 'o2LowPct': 2,
 'o2HighPct': 6}
DEFAULTS = {'fired-heater': SETTINGS}
UNITS = {'inputs': {'fuelFlowKgS,processFlowKgS': 'kg/s', '*TempC,processInC,processOutC,bridgewallAC,bridgewallBC': 'degC', 'stackO2Pct': 'wet vol%', 'processCpKjKgK': 'kJ/(kg K)'}, 'outputs': {'q*Kw': 'kW', '*Pct': '%', 'etaDeltaPp': 'percentage points', 'combustionAirKgS,stackMassKgS': 'kg/s', 'airFuelRatio': 'kg air/kg fuel', 'stackTempC,bridgewallAvgC': 'degC'}, 'timestamp': 'ISO-8601 with offset', 'status': 'text/boolean/count as named; no physical unit'}
# Embedded sample data, kept compressed to keep the calculation blocks readable.
SAMPLE = _unpack('H4sIAAAAAAAC/2WSbW/TMBDHv0pUCQkkGvyQxPbedWMTqJM2sYkXIF54yaU15KGyk4VR9btzdtqEDqlKdb/7n+/s/+0XLt9Crb+CdaZtFhfRgsZk8T5a1G0BlY9LY6FYbkF3YH3Ctb3NwWecqfsKcRE9gzWlyXWHZ0Sl+d31Fry2MzX8aZugXtUoyvWH66Jumw57YT5vm9JsMLtflD1UV9oF6cMWoIu+QAkWmhwiz6O3ksdZ8uadr7O6MKHZbevcfd5hEY1TTPSNzvO2b3CoOUVCykL5CPXuymt9XIAzm+Zj372sB2QJowmZ8HVZjrXYlE/0odP5L38AU8kE79ioTGImJniDt1lvHkJzmaiJXw6+XAiJBMpyVTwb19qXYy92pJW29YiC0Pm2J6mv54xM2GsDyzx7Gv7VSX5kJ5EUHoA+78uPcG6b+Adq2W07jDEL4Sez2Y5xdkCw01bXgFvhvIGe1KAdOl9D03n2fR8WAOesd95WRli2JGpJxSMVF4Tgb0ky/HpLn3XVg5tW4aZqh+kBqaCK8EThv0wID4tTP/XOb8DK2JOtSSyVSFiWUkIlEXJ6u5OAkyROiZKEK0bTTGYo8M3mvL+WbXNwbh6A8izOhMpSoRjWUs5m1ecmrEOazeiu78JZXMVUMiUoVyqhhPFZcrVb/1xv1r4yVrPF8yZx8XrMJ2uKDQy6qlZhg2QaS8l4iptIqcjSM8nlKBH/Sfxl7y1OgC6tdxpVTV9Vh8MPzA2mKdohGIDT2O7MMfLI+OhYTAj55g2Dpnhl6rnkcPgLJj5IOl0EAAA=')

# Repeated in each standalone file: input validation, units and time handling.
"""Offline envelope, timestamp/quality adapter and observation-window summaries.

This provisional contract is not an AVEVA API implementation. Values use the
website's documented field names and canonical units, without implicit unit
conversion. Bad/stale values become missing before engineering calculations.
ISO timestamps with offsets are preferred; naive times use America/Edmonton.
"""
import copy
import json
import math
import sys
from datetime import datetime
from pathlib import Path


def validate_config(model, cfg):
    """Reject wrong types/nonfinite configuration before performing arithmetic."""
    def shape(value, template, path):
        if isinstance(template, dict):
            if not isinstance(value, dict):raise ValueError(path+' must be an object')
            for k,t in template.items():shape(value.get(k),t,path+'.'+k)
        elif path=='config.opexRevenuePercent' and value is None:return
        elif isinstance(template, (int,float)):
            if not finite(value):raise ValueError(path+' must be finite')
        elif isinstance(template,str) and not isinstance(value,str):raise ValueError(path+' must be text')
    shape(cfg,DEFAULTS[model],'config')
    if model=='air-blower':
        s=cfg['settings']
        if s['blowerMode'] not in ('auto','A','B') or s['efficiencyMethod'] not in ('polytropic','isentropic','fluid') or s['powerFactorMode'] not in ('datasheet','fixed'):raise ValueError('Unsupported blower mode')
        if s['gammaK']<=1 or s['motorVoltageV']<=0 or not 0<s['powerFactor']<=1 or s['baselineTrainingDays']<=0 or not 0<=s['performanceBypassMaxPct']<=100:raise ValueError('Invalid blower configuration')
    elif model=='shell-tube-exchanger':
        if cfg['areaM2']<=0 or cfg['uCleanWm2k']<=0 or cfg['nShell']<1 or int(cfg['nShell'])!=cfg['nShell']:raise ValueError('Positive area, clean U and integer shell passes required')
    if model in ('fired-heater','shell-tube-exchanger','membrane-analyzer'):
        for k,v in cfg.items():
            if finite(v) and v<0 and 'Temp' not in k:raise ValueError(k+' must not be negative')

def finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)

def clean(v):
    if isinstance(v, float) and not math.isfinite(v): return None
    if isinstance(v, float) and v == 0: return 0.0
    if isinstance(v, dict): return {k: clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [clean(x) for x in v]
    return v

def epoch(value, timezone='America/Edmonton'):
    """Elapsed milliseconds; reject nonexistent/ambiguous naive DST timestamps."""
    d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if d.tzinfo is None:
        zone = ZoneInfo(timezone)
        a, b = d.replace(tzinfo=zone, fold=0), d.replace(tzinfo=zone, fold=1)
        if a.utcoffset() != b.utcoffset():
            raise ValueError('Ambiguous or nonexistent local time: supply an explicit offset')
        d = a
    return d.timestamp() * 1000

def merge(default, override):
    result = copy.deepcopy(default)
    for k, v in override.items():
        result[k] = merge(result[k], v) if isinstance(v, dict) and isinstance(result.get(k), dict) else copy.deepcopy(v)
    return result

def prepare(payload, model):
    if payload.get('schemaVersion') != '1.0' or payload.get('model') != model:
        raise ValueError('schemaVersion must be 1.0 and model must match the engine')
    timezone = payload.get('timezone', 'America/Edmonton')
    ZoneInfo(timezone)
    cfg = merge(DEFAULTS[model], payload.get('config', {}))
    if model=='crude-to-profit' and 'opex' in payload.get('config',{}) and 'opexRevenuePercent' not in payload['config']:cfg.pop('opexRevenuePercent',None)
    if model=='crude-to-profit' and 'opexRevenuePercent' in payload.get('config',{}) and payload['config']['opexRevenuePercent'] is None:raise ValueError('OPEX percentage must be finite')
    validate_config(model,cfg)
    rows, seen, warnings = [], set(), []
    for i, observation in enumerate(payload.get('measurements', [])):
        stamp = observation['timestamp']
        t = epoch(stamp, timezone)
        if t in seen: raise ValueError('Duplicate observation timestamps')
        seen.add(t)
        values = copy.deepcopy(observation.get('values', {}))
        if not isinstance(values,dict):raise ValueError('Measurement values must be an object')
        for key, quality in observation.get('quality', {}).items():
            if quality not in ('good', 'simulated', 'bad', 'stale', 'missing'):
                raise ValueError('Unsupported quality: '+str(quality))
            if quality in ('bad', 'stale', 'missing'):
                values[key] = None
                warnings.append({'code': 'MISSING_INPUT', 'path': f'measurements[{i}].{key}', 'quality': quality})
        # Normalize timestamps once so Python batch engines never mix naive/aware.
        stamp = datetime.fromtimestamp(t/1000, ZoneInfo(timezone)).isoformat()
        if 'timestamp' in values:raise ValueError('timestamp is reserved; use the observation timestamp')
        rows.append({'timestamp': stamp, **values})
    rows.sort(key=lambda r: epoch(r['timestamp']))
    if not rows: raise ValueError('At least one timestamped measurement is required')
    return cfg, rows, warnings

def averages(rows, window=None):
    """Inclusive sample window, matching dashboard averages, not an integral."""
    chosen = rows
    if window:
        start, end = epoch(window['start']), epoch(window['end'])
        if start > end: raise ValueError('Window start must not exceed end')
        chosen = [r for r in rows if start <= epoch(r['timestamp']) <= end]
    keys = sorted({k for r in chosen for k,v in r.items() if k != 'timestamp' and finite(v)})
    return {'count': len(chosen), 'sampleAverages': {k: sum(xs)/len(xs) for k in keys if (xs := [r[k] for r in chosen if finite(r.get(k))])}}

def execute(payload, model, calculate):
    """Common entry point: structured errors; no network and no hidden defaults."""
    try:
        cfg, rows, warnings = prepare(payload, model)
        result = clean(calculate(rows, cfg, payload.get('parameters', {})))
        output = {'schemaVersion': '1.0', 'model': model, 'ok': True,
                  'source': payload.get('source', 'unspecified'), 'integrationStatus': 'provisional; live AVEVA unverified',
                  'config': cfg, 'result': result, 'warnings': warnings, 'errors': []}
        output['units'] = UNITS
        if isinstance(result, list): output['window'] = averages(result, payload.get('window'))
        return output
    except (ValueError, TypeError, KeyError, IndexError, AttributeError, OverflowError, ZeroDivisionError) as exc:
        return {'schemaVersion': '1.0', 'model': model, 'ok': False, 'result': None,
                'warnings': [], 'errors': [{'code': 'INVALID_INPUT', 'message': str(exc)}]}

"""Configured engineering alerts. Sources/severity match website alert builders.

Missing metrics do not establish normal equipment health. Consumers must also
inspect null calculated values; severity is only the roll-up of available alerts.
"""

def annotate(model, row, cfg):
    alerts=[]
    def add(severity,source):alerts.append(dict(severity=severity,source=source))
    def threshold(key,alarm,advisory,source,low=False,absolute=False):
        v=row.get(key)
        if not finite(v):return
        if absolute:v=abs(v)
        if (v<cfg[alarm] if low else v>=cfg[alarm]):add('alarm',source)
        elif (v<cfg[advisory] if low else v>=cfg[advisory]):add('advisory',source)
    def below(key,limit,source):
        if finite(row.get(key)) and row[key]<cfg[limit]:add('advisory',source)
    if model=='fired-heater':
        threshold('etaHeatBalancePct','effAlarmPct','effAdvisoryPct','configured efficiency threshold',True)
        threshold('stackTempC','stackAlarmC','stackAdvisoryC','convection fouling')
        threshold('bridgewallAvgC','bwAlarmC','bwAdvisoryC','tube metallurgy')
        v=row.get('stackO2Pct')
        if finite(v):
            if v<cfg['o2LowPct']:add('alarm','combustion safety')
            elif v>cfg['o2HighPct']:add('advisory','burner trim')
        threshold('excessAirPct','eaAlarmPct','eaAdvisoryPct','configured excess-air threshold')
        if finite(row.get('etaDeltaPp')) and abs(row['etaDeltaPp'])>3:add('advisory','closure check')
    elif model=='shell-tube-exchanger':
        if row['crossover']:add('alarm','LMTD / F-factor')
        threshold('rfE4','rfAlarmE4','rfAdvisoryE4','fouling')
        threshold('dutyDeviationPct','dutyAlarmPct','dutyAdvisoryPct','duty vs design',absolute=True)
        below('effectivenessPct','effAdvisoryPct','effectiveness')
        if finite(row.get('imbalancePct')) and row['imbalancePct']>cfg['imbalanceAdvisoryPct']:add('advisory','energy balance')
        below('approachHotC','approachMinC','approach');below('approachColdC','approachMinC','approach')
    else:
        if finite(row.get('ratio')) and row['ratio']>=cfg['ratioAlarm']:add('alarm','recovery ratio controller')
        below('recoveryOnlinePct','recoveryFloorPct','recovery target')
        threshold('permeateH2OnlinePct','purityAlarmPct','purityAdvisoryPct','permeate analyzer',True)
        p=row.get('feedPressureKpag');design=cfg['designFeedPressureKpag']
        if finite(p) and (abs((p-design)/design*100) if design else float('inf') if p else 0)>cfg['feedPressureDeviationPct']:add('advisory','feed pressure')
    return {**row,'alerts':alerts,'severity':'alarm' if any(a['severity']=='alarm' for a in alerts) else 'advisory' if alerts else 'ok'}

"""Provisional tag mapping only. No AVEVA endpoint, SDK or credentials.

The caller supplies records with timestamp and tags dictionaries. A tagMap
maps each site tag to a documented engine field and canonical unit. No implicit
unit conversion is made. Site-specific AVEVA extraction belongs upstream.
"""
def map_records(model, records, tag_map, config=None, source='unspecified'):
    measurements=[]
    for record in records:
        values,quality={},{}
        for tag,mapping in tag_map.items():
            field=mapping['field'];item=record.get('tags',{}).get(tag)
            if item is None:values[field]=None;quality[field]='missing';continue
            if item.get('unit')!=mapping['unit']:raise ValueError('Unit mismatch for '+tag)
            values[field]=item.get('value');quality[field]=item.get('quality','good')
        measurements.append({'timestamp':record['timestamp'],'values':values,'quality':quality})
    return {'schemaVersion':'1.0','model':model,'source':source,'timezone':'America/Edmonton','config':config or {},'measurements':measurements}

# MODEL CALCULATIONS
"""Fired Heater: wet-O2 combustion, heat balance and constant-Cp process duty.

Inputs: flows kg/s, temperatures degC, process Cp kJ/(kg K), wet O2 vol%.
Outputs: heat flows kW, efficiencies %, closure %, air/fuel kg/kg.
Named fuel properties are retained from the client reference; custom molar
fractions are normalized. Complete combustion and constant Cp are assumptions.
Invalid measurements yield null dependent outputs. This is not a formal PTC test.
Run: python engines/fired_heater_engine.py examples/fired-heater.input.json
"""
import json
FUEL = {'CP_COMBUSTION_AIR_KJKGK': 1.006, 'CP_FLUE_GAS_KJKGK': 1.062, 'CP_FLUE_GAS_PTC4_KJKGK': 1.08, 'CP_FUEL_GAS_KJKGK': 2.6038, 'CP_VAPOR_KJKGK': 2, 'FUEL_COMPONENT_PROPS': {'Water': {'mw': 18.02, 'lhvMjKg': 0, 'o2': 0, 'h2o': 0, 'co2': 0}, 'Hydrogen_Sulfide': {'mw': 34.08, 'lhvMjKg': 15.22, 'o2': 1.5, 'h2o': 1, 'co2': 0}, 'Hydrogen': {'mw': 2.02, 'lhvMjKg': 120.97, 'o2': 0.5, 'h2o': 1, 'co2': 0}, 'Nitrogen': {'mw': 28, 'lhvMjKg': 0, 'o2': 0, 'h2o': 0, 'co2': 0}, 'Oxygen_Argon': {'mw': 32, 'lhvMjKg': 0, 'o2': -1, 'h2o': 0, 'co2': 0}, 'CO2': {'mw': 44, 'lhvMjKg': 0, 'o2': 0, 'h2o': 0, 'co2': 0}, 'CO': {'mw': 28, 'lhvMjKg': 10.11, 'o2': 0.5, 'h2o': 0, 'co2': 1}, 'Methane': {'mw': 16.04, 'lhvMjKg': 50.01, 'o2': 2, 'h2o': 2, 'co2': 1}, 'Ethane': {'mw': 30.06, 'lhvMjKg': 47.79, 'o2': 3.5, 'h2o': 3, 'co2': 2}, 'Ethylene': {'mw': 28.04, 'lhvMjKg': 47.2, 'o2': 3, 'h2o': 2, 'co2': 2}, 'Propane': {'mw': 44.08, 'lhvMjKg': 46.36, 'o2': 5, 'h2o': 4, 'co2': 3}, 'Propylene': {'mw': 42.06, 'lhvMjKg': 45.8, 'o2': 4.5, 'h2o': 3, 'co2': 3}, 'Isobutane': {'mw': 58.12, 'lhvMjKg': 45.72, 'o2': 6.5, 'h2o': 5, 'co2': 4}, 'n-Butane': {'mw': 58.12, 'lhvMjKg': 45.72, 'o2': 6.5, 'h2o': 5, 'co2': 4}, 'Butene': {'mw': 56.1, 'lhvMjKg': 45.3, 'o2': 6, 'h2o': 4, 'co2': 4}, 'Isopentane': {'mw': 72.15, 'lhvMjKg': 45.24, 'o2': 8, 'h2o': 6, 'co2': 5}, 'n-Pentane': {'mw': 72.15, 'lhvMjKg': 45.24, 'o2': 8, 'h2o': 6, 'co2': 5}, 'C6+': {'mw': 86.18, 'lhvMjKg': 44.75, 'o2': 9.5, 'h2o': 7, 'co2': 6}}, 'FUEL_GAS_CASES': {'Sheet Reference Case (83.64%)': {'averageMw': 13.83, 'lhvMjKg': 49.469, 'fractions': {'Water': 0, 'Hydrogen_Sulfide': 0, 'Hydrogen': 0.40976, 'Nitrogen': 0.01406, 'Oxygen_Argon': 0, 'CO2': 0, 'CO': 0, 'Methane': 0.45345, 'Ethane': 0.07221, 'Ethylene': 0, 'Propane': 0.02689, 'Propylene': 0, 'Isobutane': 0, 'n-Butane': 0, 'Butene': 0, 'Isopentane': 0, 'n-Pentane': 0, 'C6+': 0.02363}}, 'Summer EOR': {'averageMw': 12.9689, 'lhvMjKg': 50.6902, 'fractions': {'Water': 0.0034, 'Hydrogen_Sulfide': 0, 'Hydrogen': 0.3809, 'Nitrogen': 0.0188, 'Oxygen_Argon': 0.0009, 'CO2': 0.0013, 'CO': 0.0003, 'Methane': 0.4983, 'Ethane': 0.0727, 'Ethylene': 0.0017, 'Propane': 0.0101, 'Propylene': 0.0002, 'Isobutane': 0.0013, 'n-Butane': 0.0028, 'Butene': 0, 'Isopentane': 0.0015, 'n-Pentane': 0.0029, 'C6+': 0.003}}, 'Winter SOR': {'averageMw': 13.6498, 'lhvMjKg': 50.157, 'fractions': {'Water': 0.0029, 'Hydrogen_Sulfide': 0, 'Hydrogen': 0.328, 'Nitrogen': 0.0183, 'Oxygen_Argon': 0.0007, 'CO2': 0.0018, 'CO': 0.0002, 'Methane': 0.5567, 'Ethane': 0.0671, 'Ethylene': 0.0015, 'Propane': 0.0106, 'Propylene': 0.0002, 'Isobutane': 0.0017, 'n-Butane': 0.0029, 'Butene': 0, 'Isopentane': 0.0014, 'n-Pentane': 0.0026, 'C6+': 0.0027}}, 'H2 Rich Case Winter SOR': {'averageMw': 11.137, 'lhvMjKg': 53.1777, 'fractions': {'Water': 0.0023, 'Hydrogen_Sulfide': 0, 'Hydrogen': 0.5728, 'Nitrogen': 0.018, 'Oxygen_Argon': 0.0008, 'CO2': 0.0001, 'CO': 0.0002, 'Methane': 0.2845, 'Ethane': 0.0671, 'Ethylene': 0.0016, 'Propane': 0.032, 'Propylene': 0, 'Isobutane': 0.0018, 'n-Butane': 0.0125, 'Butene': 0, 'Isopentane': 0.0011, 'n-Pentane': 0.0014, 'C6+': 0.0032}}, 'C3 Rich Case Winter EOR': {'averageMw': 21.0556, 'lhvMjKg': 47.4538, 'fractions': {'Water': 0.0025, 'Hydrogen_Sulfide': 0, 'Hydrogen': 0.1996, 'Nitrogen': 0.0235, 'Oxygen_Argon': 0.0013, 'CO2': 0.0003, 'CO': 0.0004, 'Methane': 0.4849, 'Ethane': 0.1177, 'Ethylene': 0.0027, 'Propane': 0.0992, 'Propylene': 0.0019, 'Isobutane': 0.0244, 'n-Butane': 0.0288, 'Butene': 0.004, 'Isopentane': 0.0019, 'n-Pentane': 0.0059, 'C6+': 0.0046}}, 'Type Natural Gas (Startup, pilot)': {'averageMw': 17.0601, 'lhvMjKg': 47.7802, 'fractions': {'Water': 0, 'Hydrogen_Sulfide': 0, 'Hydrogen': 0, 'Nitrogen': 0.0164, 'Oxygen_Argon': 0, 'CO2': 0.0053, 'CO': 0, 'Methane': 0.9429, 'Ethane': 0.0267, 'Ethylene': 0, 'Propane': 0.0058, 'Propylene': 0, 'Isobutane': 0.001, 'n-Butane': 0.0011, 'Butene': 0, 'Isopentane': 0.0003, 'n-Pentane': 0.0002, 'C6+': 0.0003}}, 'Average Fuel Gas': {'averageMw': 15.0834, 'lhvMjKg': 49.3242, 'fractions': {'Water': 0.001, 'Hydrogen_Sulfide': 0.00099, 'Hydrogen': 0.34242, 'Nitrogen': 0.01548, 'Oxygen_Argon': 0.00116, 'CO2': 0.0024, 'CO': 0.00074, 'Methane': 0.52052, 'Ethane': 0.08416, 'Ethylene': 0.00036, 'Propane': 0.02416, 'Propylene': 0.0003, 'Isobutane': 0.0024, 'n-Butane': 0.0029, 'Butene': 0.0015, 'Isopentane': 0.001, 'n-Pentane': 0.0011, 'C6+': 0.0146}}}, 'N2_MW': 28, 'N2_VOL_FRAC_AIR': 0.79, 'O2_MW': 32, 'O2_VOL_FRAC_AIR': 0.21, 'T_REF_DEFAULT_C': 15}
PROPS, CASES = FUEL['FUEL_COMPONENT_PROPS'], FUEL['FUEL_GAS_CASES']

def composition(name, custom=None):
    if name != 'Custom': return CASES.get(name)
    if not custom: return None
    z = custom.get('fractions', {})
    if any(k not in PROPS or not finite(v) or v < 0 for k,v in z.items()): return None
    total = sum(z.values())
    if total <= 0: return None
    z = {k:v/total for k,v in z.items()}
    mw = sum(v*PROPS[k]['mw'] for k,v in z.items())
    if mw <= 0: return None
    return {'fractions':z, 'averageMw':mw, 'lhvMjKg':sum(v*PROPS[k]['mw']/mw*PROPS[k]['lhvMjKg'] for k,v in z.items())}

def combustion(mf, oxygen, comp):
    """Solve excess oxygen from wet flue-gas mol balance including feed inerts."""
    if not finite(mf) or mf <= 0 or not finite(oxygen) or not 0 <= oxygen < (100*FUEL['O2_VOL_FRAC_AIR']): return None
    mol = mf/comp['averageMw']; o2 = water = carbon = nitrogen = 0
    for k,z in comp['fractions'].items():
        if k not in PROPS: continue
        p=PROPS[k]; n=mol*z
        o2+=n*p['o2']; water+=n*p['h2o']; carbon+=n*p['co2']
        if k in ('CO2','Hydrogen_Sulfide'): carbon+=n
        if k=='Nitrogen': nitrogen+=n
    ratio=FUEL['N2_VOL_FRAC_AIR']/FUEL['O2_VOL_FRAC_AIR']
    y=oxygen/100; den=1-y*(1+ratio)
    if abs(den)<1e-9: return None
    excess=y*(carbon+water+nitrogen+o2*ratio)/den
    air=(o2+excess)*(FUEL['O2_MW']+ratio*FUEL['N2_MW'])
    return air, mf+air, air/mf

def calc_row(row, cfg):
    fields='fuelFlowKgS combustionAirTempC stackTempC fuelTempC processFlowKgS processInC processOutC processCpKjKgK stackO2Pct bridgewallAC bridgewallBC'.split()
    r={k:row.get(k) for k in fields}
    for k,v in r.items():
        if not finite(v) or (k.endswith('C') and v<=-273.15) or ('Flow' in k and v<0) or ('Cp' in k and v<=0) or (k=='stackO2Pct' and not 0<=v<(100*FUEL['O2_VOL_FRAC_AIR'])): r[k]=None
    keys='bridgewallAvgC excessAirPct etaHeatBalancePct etaPtc4Pct etaProcessPct etaDeltaPp qLhvKw qAbsorbedKw qProcessKw qFuelSensibleKw qCombustionAirKw qStackKw qRadiationLossKw qInKw combustionAirKgS stackMassKgS airFuelRatio dryLossPct moistureLossPct radiationLossPct unaccountedLossPct closurePct'.split()
    o=dict.fromkeys(keys); o.update(timestamp=row['timestamp'],stackTempC=r['stackTempC'],stackO2Pct=r['stackO2Pct'])
    wall=[r[k] for k in ('bridgewallAC','bridgewallBC') if r[k] is not None]
    o['bridgewallAvgC']=sum(wall)/len(wall) if wall else None
    comp=composition(row.get('fuelCaseOverride') or cfg['fuelCase'],cfg.get('customCase'))
    if not comp or not finite(comp['averageMw']) or comp['averageMw']<=0 or not finite(comp['lhvMjKg']) or comp['lhvMjKg']<=0: return o
    lhv=comp['lhvMjKg']*1000; mf=r['fuelFlowKgS']; oxygen=r['stackO2Pct']; tref=cfg['refTempC']
    if oxygen is not None:
        actual, stoich=combustion(1,oxygen,comp),combustion(1,0,comp)
        if actual and stoich and stoich[2]>0: o['excessAirPct']=100*(actual[2]/stoich[2]-1)
        cm=combustion(mf,oxygen,comp)
        if cm: o['combustionAirKgS'],o['stackMassKgS'],o['airFuelRatio']=cm
    if mf is not None:
        o['qLhvKw']=mf*lhv
        o['qRadiationLossKw']=o['qLhvKw']*cfg['radiationLossPct']/100
        if r['fuelTempC'] is not None: o['qFuelSensibleKw']=mf*FUEL['CP_FUEL_GAS_KJKGK']*(r['fuelTempC']-tref)
    if o['combustionAirKgS'] is not None and r['combustionAirTempC'] is not None: o['qCombustionAirKw']=o['combustionAirKgS']*FUEL['CP_COMBUSTION_AIR_KJKGK']*(r['combustionAirTempC']-tref)
    if o['stackMassKgS'] is not None and r['stackTempC'] is not None: o['qStackKw']=o['stackMassKgS']*FUEL['CP_FLUE_GAS_KJKGK']*(r['stackTempC']-tref)
    def available(*keys): return all(o[k] is not None for k in keys)
    if available('qLhvKw','qFuelSensibleKw','qCombustionAirKw'): o['qInKw']=o['qLhvKw']+o['qFuelSensibleKw']+o['qCombustionAirKw']
    if available('qInKw','qStackKw','qRadiationLossKw'): o['qAbsorbedKw']=o['qInKw']-o['qStackKw']-o['qRadiationLossKw']
    if available('qAbsorbedKw','qLhvKw') and o['qLhvKw']>0: o['etaHeatBalancePct']=100*o['qAbsorbedKw']/o['qLhvKw']
    if all(r[k] is not None for k in ('processFlowKgS','processCpKjKgK','processInC','processOutC')):
        o['qProcessKw']=r['processFlowKgS']*r['processCpKjKgK']*(r['processOutC']-r['processInC'])
        if o['qLhvKw'] is not None and o['qLhvKw']>0: o['etaProcessPct']=100*o['qProcessKw']/o['qLhvKw']
    if o['excessAirPct'] is not None and r['stackTempC'] is not None:
        air=(1+o['excessAirPct']/100)*combustion(1,0,comp)[2]
        water=sum(v*PROPS[k]['h2o'] for k,v in comp['fractions'].items() if k in PROPS)*18.02/comp['averageMw']
        amb=r['combustionAirTempC'] if r['combustionAirTempC'] is not None else tref
        tf=r['fuelTempC'] if r['fuelTempC'] is not None else 25
        o['dryLossPct']=100*(1+air-water)*FUEL['CP_FLUE_GAS_PTC4_KJKGK']*(r['stackTempC']-amb)/lhv
        o['moistureLossPct']=100*water*FUEL['CP_VAPOR_KJKGK']*(r['stackTempC']-tf)/lhv
        o['radiationLossPct']=cfg['radiationLossPct'];o['unaccountedLossPct']=cfg['unaccountedLossPct']
        o['etaPtc4Pct']=100-o['dryLossPct']-o['moistureLossPct']-o['radiationLossPct']-o['unaccountedLossPct']
    if available('etaHeatBalancePct','etaProcessPct'): o['etaDeltaPp']=o['etaHeatBalancePct']-o['etaProcessPct']
    if available('qAbsorbedKw','qProcessKw','qLhvKw') and o['qLhvKw']>0: o['closurePct']=100*abs(o['qAbsorbedKw']-o['qProcessKw'])/o['qLhvKw']
    return o


def calculate(rows, config, parameters):
    """Evaluate every observation independently; common.py applies date summaries."""
    return [annotate('fired-heater',calc_row(r,config),config) for r in rows]

def run(payload): return execute(payload,'fired-heater',calculate)


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        try:
            payload = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
            output = run(payload)
        except (OSError, ValueError) as exc:
            output = {'ok': False, 'errors': [{'code': 'INVALID_JSON', 'message': str(exc)}]}
        print(json.dumps(clean(output), ensure_ascii=False, allow_nan=False))
        sys.exit(0 if output['ok'] else 1)
    else:
        SAMPLE['config'] = SETTINGS
        output = run(SAMPLE)
        destination = Path(__file__).with_name('fired_heater_results.json')
        destination.write_text(json.dumps(clean(output), indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        print('Example calculation ' + ('completed.' if output['ok'] else 'failed; see errors in results.'))
        print('Results saved to:', destination)
        print('Edit SETTINGS near the top of this file, then run again.')
        if not output['ok']: sys.exit(1)
