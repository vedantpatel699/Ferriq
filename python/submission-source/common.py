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
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS = json.loads((ROOT / 'data/defaults.json').read_text(encoding='utf-8'))

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
        output['units'] = json.loads((ROOT/'data/units.json').read_text(encoding='utf-8'))[model]
        if isinstance(result, list): output['window'] = averages(result, payload.get('window'))
        return output
    except (ValueError, TypeError, KeyError, IndexError, AttributeError, OverflowError, ZeroDivisionError) as exc:
        return {'schemaVersion': '1.0', 'model': model, 'ok': False, 'result': None,
                'warnings': [], 'errors': [{'code': 'INVALID_INPUT', 'message': str(exc)}]}

def cli(run):
    """python engines/<model>_engine.py examples/<model>.input.json"""
    try:
        text = Path(sys.argv[1]).read_text(encoding='utf-8-sig') if len(sys.argv)>1 else sys.stdin.read()
        out = run(json.loads(text))
    except (OSError, ValueError) as exc:
        out = {'ok': False, 'errors': [{'code': 'INVALID_JSON', 'message': str(exc)}]}
    print(json.dumps(clean(out), ensure_ascii=False, allow_nan=False))
    if not out['ok']: sys.exit(1)
