"""shell-tube-exchanger: standalone calculation file.
Run with Python 3.10 or newer (IDLE: Run > Run Module, or python shell_tube_exchanger_engine.py).
No installation packages, network connection or other files are required.
Edit SETTINGS below to change configuration. With no arguments, a simulated
example runs and saves shell_tube_exchanger_results.json beside this file.
Optional: python shell_tube_exchanger_engine.py input.json > output.json
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
SETTINGS = {'nShell': 2,
 'areaM2': 124.8,
 'uCleanWm2k': 500,
 'designQMw': 3.5,
 'rfAdvisoryE4': 5,
 'rfAlarmE4': 10,
 'effAdvisoryPct': 50,
 'imbalanceAdvisoryPct': 8,
 'approachMinC': 10,
 'dutyAdvisoryPct': 5,
 'dutyAlarmPct': 10}
DEFAULTS = {'shell-tube-exchanger': SETTINGS}
UNITS = {'inputs': {'*InC,*OutC': 'degC', '*FlowKgHr': 'kg/h', '*CpKjKgK': 'kJ/(kg K)', 'shellDpBar,tubeDpBar': 'bar'}, 'outputs': {'q*Kw': 'kW', 'qAvgMw': 'MW', 'lmtdC,lmtdEffC,approachHotC,approachColdC': 'K temperature difference', 'uDirtyWm2k': 'W/(m2 K)', 'rfE4': '1e-4 m2 K/W', '*Pct': '%', 'pRatio,rRatio,fFactor': 'dimensionless', 'shellDpBar,tubeDpBar': 'bar'}, 'timestamp': 'ISO-8601 with offset', 'status': 'text/boolean/count as named; no physical unit'}
# Embedded sample data, kept compressed to keep the calculation blocks readable.
SAMPLE = _unpack('H4sIAAAAAAAC/11SXW/TMBT9K1We13D9ETvZ2yhDoKoCxAQSiAcvcVpD7ESO025U/e+7djpYJ0VR7jnH59gnPmZjvdNWfdN+NL3LrhcZySG7WmS2b3QX53Gnu24Zpnu91A/1Trmt9lEw9pOvdVIYO3Uq6Gax1960plYBvRateQiT11EbjNV/e5fUNxZFtXpz29jeBcxEvu5da7bIHjP3NebhJ0Vcea02FAdCeV4iMK06rdx3S/8gWAAg1OjRbN2XzQERlheI+Pam2Zux94+3PMpmqFPeppnEVbr9J/pch2SGqLH3qlOu1pdcTFbD4HtV7zbGrZ5Nmik8vnJ5RmPaDBE4ITgor6wOWHM8ZUSsViPWY7ULEft5TC2NQdkh1kSBiiVUSyLviLwGwGcJAt+xr73qJp2csl0fPqYdUcmRwfHTFNIOpcyFrCgHVgIIUc3s+64/rLcfPCp4SajIBQdCBKGSslmxGta/19t1tMy54CL9n66ZU0hSxfkcQ4HkVUmASsYrxiTIM/8iSDIqi1xUksiCEhDlWfI/CT0kJ1fn2/ZueKviOsjRHUglQJacESZpNI9X8YWCCzx5AVUJrKKkkKfTLxQdjGv6Q2oIK/XholK4o2yuNAeAH7FR7ZpXrV9KTqcnWiWR9SsDAAA=')

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
"""Single-phase exchanger duty, N-shell F correction, U and fouling.

Flows kg/h; Cp kJ/(kg K); temperatures degC; area m2; U W/(m2 K).
Duty is kW/MW; Rf is reported in 1e-4 m2 K/W. Null U/Rf is retained on
invalid correction-factor domains; no substitute F is inserted. Geometry
assumes the website's N-shell/2N-tube-pass arrangement, not every TEMA type.
Run: python engines/shell_tube_exchanger_engine.py examples/shell-tube-exchanger.input.json
"""
import math

def correction(P,R,N):
    if not all(finite(x) for x in (P,R,N)) or P<0 or R<0 or int(N)!=N or N<=0 or P>=1 or P*R>=1: return None
    if abs(R-1)<1e-9:
        den=N-P*(N-1)
        if abs(den)<1e-9: return None
        p=P/den; s=p*math.sqrt(2)/(2-p)
        if abs(s)>=1: return None
        a=.5*math.log((1+s)/(1-s))
        return 1. if abs(a)<1e-9 else p*math.sqrt(2)/((2-p)*a)
    x=((1-P*R)/(1-P))**(1/N)
    if abs(R-x)<1e-9:return None
    p=(1-x)/(R-x); a=math.sqrt(R*R+1); b=(1-p)/(1-p*R)
    c=2-p*(R+1-a); d=2-p*(R+1+a)
    if b<=0 or c<=0 or d<=0:return None
    log=math.log(c/d)
    return 1. if abs(log)<1e-9 else a*math.log(b)/((R-1)*log)

def calc_row(r,c):
    keys='qHotKw qColdKw qAvgKw qAvgMw imbalancePct lmtdC lmtdEffC pRatio rRatio fFactor uDirtyWm2k rfE4 effectivenessPct approachHotC approachColdC dutyDeviationPct'.split()
    o=dict.fromkeys(keys);o.update(timestamp=r['timestamp'],crossover=False,shellDpBar=r.get('shellDpBar'),tubeDpBar=r.get('tubeDpBar'))
    th,tho,tc,tco,mh,cph,mc,cpc=[r.get(k) for k in 'hotInC hotOutC coldInC coldOutC hotFlowKgHr hotCpKjKgK coldFlowKgHr coldCpKjKgK'.split()]
    if not all(finite(x) for x in (th,tho,tc,tco,mh,cph,mc,cpc)):return o
    if min(mh,cph,mc,cpc)<=0 or min(th,tho,tc,tco)<=-273.15 or th<tho or tco<tc or not finite(c['areaM2']) or c['areaM2']<=0:return o
    o['qHotKw']=mh*cph*(th-tho)/3600;o['qColdKw']=mc*cpc*(tco-tc)/3600
    q=(o['qHotKw']+o['qColdKw'])/2;o['qAvgKw']=q;o['qAvgMw']=q/1000
    if abs(q)>1e-9:o['imbalancePct']=100*abs(o['qHotKw']-o['qColdKw'])/abs(q)
    cmin=min(mh*cph/3600,mc*cpc/3600)
    if th>tc and cmin>0:o['effectivenessPct']=100*q/(cmin*(th-tc))
    d1,d2=th-tco,tho-tc;o['approachHotC']=d1;o['approachColdC']=d2
    if c['designQMw']>0:o['dutyDeviationPct']=100*(q/1000-c['designQMw'])/c['designQMw']
    if min(d1,d2)<=0:o['crossover']=True;return o
    lmtd=(d1-d2)/math.log(d1/d2) if abs(d1-d2)>1e-9 else d1;o['lmtdC']=lmtd
    R=(th-tho)/(tco-tc) if abs(tco-tc)>1e-9 else None;P=(tco-tc)/(th-tc) if abs(th-tc)>1e-9 else None
    o['pRatio']=P;o['rRatio']=R
    F=correction(P,R,c['nShell']) if P is not None and R is not None else None;o['fFactor']=F
    if F is None:o['crossover']=True;return o
    o['lmtdEffC']=lmtd*F;den=c['areaM2']*F*lmtd
    if abs(den)>1e-9:o['uDirtyWm2k']=q*1000/den
    if o['uDirtyWm2k'] is not None and o['uDirtyWm2k']>0 and c['uCleanWm2k']>0:o['rfE4']=(1/o['uDirtyWm2k']-1/c['uCleanWm2k'])*1e4
    return o


def calculate(rows, config, parameters):return [annotate('shell-tube-exchanger',calc_row(r,config),config) for r in rows]
def run(payload):return execute(payload,'shell-tube-exchanger',calculate)


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
        destination = Path(__file__).with_name('shell_tube_exchanger_results.json')
        destination.write_text(json.dumps(clean(output), indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        print('Example calculation ' + ('completed.' if output['ok'] else 'failed; see errors in results.'))
        print('Results saved to:', destination)
        print('Edit SETTINGS near the top of this file, then run again.')
        if not output['ok']: sys.exit(1)
