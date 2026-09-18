"""membrane-analyzer: standalone calculation file.
Run with Python 3.10 or newer (IDLE: Run > Run Module, or python membrane_analyzer_engine.py).
No installation packages, network connection or other files are required.
Edit SETTINGS below to change configuration. With no arguments, a simulated
example runs and saves membrane_analyzer_results.json beside this file.
Optional: python membrane_analyzer_engine.py input.json > output.json
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
SETTINGS = {'designFeedH2Pct': 87.32,
 'designPermeateH2Pct': 95.53,
 'designRecoveryPct': 90,
 'designFlowNm3Hr': 96277,
 'designRatio': 5.6,
 'designFeedPressureKpag': 15890,
 'patmKpa': 93,
 'recoveryFloorPct': 75,
 'purityAdvisoryPct': 93,
 'purityAlarmPct': 90,
 'ratioAlarm': 6.4,
 'feedPressureDeviationPct': 5}
DEFAULTS = {'membrane-analyzer': SETTINGS}
UNITS = {'inputs': {'*FlowNm3Hr': 'Nm3/h', '*H2*Pct': 'vol%', 'feedPressureKpag': 'kPag'}, 'outputs': {'*FlowNm3Hr': 'Nm3/h', '*H2*Pct': 'vol%', 'recovery*Pct,feedPressureDeviationPct': '%', 'feedPressureKpag': 'kPag', 'ratio': 'dimensionless'}, 'timestamp': 'ISO-8601 with offset', 'status': 'text/boolean/count as named; no physical unit'}
# Embedded sample data, kept compressed to keep the calculation blocks readable.
SAMPLE = _unpack('H4sIAAAAAAAC/3WS3YrbMBCFXyX4ulH1Y0n23i20S6ClDWXpRUsvtPZkK7CkICtJsyHv3pGSOknbBWPwOZ9nDkc6VGP3E5z5CnG0wVd3s4oRWr2ZVS70MORvB+4pGg9z482wf4GY3TFsYgfZHq3bDCZBP9tCtCvbmYSDZiv7K20iZDZZBy/BF/reIdSZt+97F3zCheh3wa/sM7qHqofRPvsHgH7Bl11CrdFEcIROzhKiA1z2x20lkWJyv0AXMMT+7NHJeBjC7pMTi5hlxbW+/JLToiqJutC4fhlhHDH/h7XJyZhsyri1SQ6lPCavjeeFOD/E01YtM7aJNu3v+60dwxRHXIzBRHcVMuYQRURFkRql1VWGd7C1pdTTL/JYgkTjIOGp5d6ygr1k2IFPWft+KL2Pybh1Lp5Trua0nTP9yPQdpfjMqcJ3PoGtGTZQJpXFN3WxuqZEMcU5VTXTOZwP00Fco6wRDSNMN61upGo1zez6P6AWVLakFprXnGpOxRW34J/9YD2c69GkqbmQvK0Z06rWN+RH8/Q6tiqXaEKahijcJ7jgdSvKpTkR1+tegf65DC3lhEvBG4okl/J4/IHozvo+7EqLWHtMN7XTRy5OtRNK6bfcOvj+r5O5RY7H3/ZHKAOeAwAA')

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
"""Hydrogen recovery, purity, pressure deviation and feed/nonpermeate ratio.

All gas flows must share the same normal-volume basis (Nm3/h); composition
is vol%; pressure kPag. Missing nonpermeate is feed minus permeate only when
physically possible. Missing online feed H2 uses lab H2 for recovery, without
inventing continuous measurements. Zero permeate gives zero recovery.
Run: python engines/membrane_analyzer_engine.py examples/membrane-analyzer.input.json
"""

def calc_row(row,c):
    fields='feedFlowNm3Hr nonPermeateFlowNm3Hr permeateFlowNm3Hr permeateH2OnlinePct permeateH2LabPct feedH2LabPct feedH2OnlinePct feedPressureKpag'.split()
    r={k:row.get(k) for k in fields}
    r={k:(v if finite(v) and v>=0 and (not k.endswith('Pct') or v<=100) else None) for k,v in r.items()}
    f,p=r['feedFlowNm3Hr'],r['permeateFlowNm3Hr']; balanced=f is not None and p is not None and p<=f
    n=r['nonPermeateFlowNm3Hr']
    if n is None and balanced:n=f-p
    y=r['feedH2OnlinePct'] if r['feedH2OnlinePct'] is not None else r['feedH2LabPct']
    def recovery(feed,purity):return p*purity/(f*feed)*100 if balanced and f>0 and feed is not None and feed>0 and purity is not None else None
    pressure=r['feedPressureKpag']
    return {'timestamp':row['timestamp'],'nonPermeateFlowNm3Hr':n,'ratio':f/n if f is not None and n is not None and n>0 else None,
      'recoveryOnlinePct':recovery(y,r['permeateH2OnlinePct']),'recoveryLabPct':recovery(r['feedH2LabPct'],r['permeateH2LabPct']),
      'feedPressureKpag':pressure,'feedPressureDeviationPct':100*(pressure-c['designFeedPressureKpag'])/c['designFeedPressureKpag'] if pressure is not None and c['designFeedPressureKpag']>0 else None,
      **{k:r[k] for k in ('permeateH2OnlinePct','permeateH2LabPct','feedH2OnlinePct','feedH2LabPct','feedFlowNm3Hr')}}


def calculate(rows,config,parameters):return [annotate('membrane-analyzer',calc_row(r,config),config) for r in rows]
def run(payload):return execute(payload,'membrane-analyzer',calculate)


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
        destination = Path(__file__).with_name('membrane_analyzer_results.json')
        destination.write_text(json.dumps(clean(output), indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        print('Example calculation ' + ('completed.' if output['ok'] else 'failed; see errors in results.'))
        print('Results saved to:', destination)
        print('Edit SETTINGS near the top of this file, then run again.')
        if not output['ok']: sys.exit(1)
