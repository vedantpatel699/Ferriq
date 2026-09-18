"""Build six self-contained client files from verified calculation sources."""
import base64, gzip, json, re, sys, pprint
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'python/submission-source'
package=root/'submission/sudhakar'
models={'air_blower':'air-blower','fired_heater':'fired-heater','shell_tube_exchanger':'shell-tube-exchanger','membrane_analyzer':'membrane-analyzer','furnace_skin_ti_predictor':'furnace-skin-temp','crude_to_profit':'crude-to-profit'}
def packed(value):return repr(base64.b64encode(gzip.compress(json.dumps(value).encode(),mtime=0)).decode())
def read(name):return json.loads((package/name).read_text(encoding='utf-8'))
common=(source/'common.py').read_text()
common=re.sub(r'ROOT = .*\nDEFAULTS = .*\n','',common)
common=common.replace("json.loads((ROOT/'data/units.json').read_text(encoding='utf-8'))[model]",'UNITS')
common=common[:common.index('\ndef cli(')]
# Bundle Edmonton TZif data so Windows requires no pip installation.
import zoneinfo
try:
 import tzdata
 tzfile=Path(tzdata.__file__).parent/'zoneinfo/America/Edmonton'
except ImportError:
 tzfile=next(Path(p)/'America/Edmonton' for p in zoneinfo.TZPATH if (Path(p)/'America/Edmonton').exists())
tz=repr(base64.b64encode(tzfile.read_bytes()).decode())
for module,model in models.items():
 sample=read(f'examples/{model}.input.json')
 # Embedded sample is concise except where a forecast needs its complete history.
 if model!='furnace-skin-temp':sample['measurements']=sample['measurements'][-48:]
 parameters=sample.get('parameters',{})
 parameters.pop('model',None)
 header=f'''"""{model}: standalone calculation file.
Run with Python 3.10 or newer (IDLE: Run > Run Module, or python {module}_engine.py).
No installation packages, network connection or other files are required.
Edit SETTINGS below to change configuration. With no arguments, a simulated
example runs and saves {module}_results.json beside this file.
Optional: python {module}_engine.py input.json > output.json
The common schema is provisional; live AVEVA integration remains unverified.
"""
import base64, gzip, json, io
from pathlib import Path
from zoneinfo import ZoneInfo as _ZoneInfo

def ZoneInfo(key):
    if key == "America/Edmonton":
        return _ZoneInfo.from_file(io.BytesIO(base64.b64decode({tz})), key=key)
    return _ZoneInfo(key)

def _unpack(text):
    return json.loads(gzip.decompress(base64.b64decode(text)))

# USER SETTINGS: defaults are the same as the website. Edit these values.
SETTINGS = {pprint.pformat(read('data/defaults.json')[model], width=90, sort_dicts=False)}
DEFAULTS = {{{model!r}: SETTINGS}}
UNITS = {repr(read('data/units.json')[model])}
# Embedded sample data, kept compressed to keep the calculation blocks readable.
SAMPLE = _unpack({packed(sample)})
'''
 body=(source/f'{module}_engine.py').read_text()
 body=re.sub(r'^from (common|alerts) import .*\n','',body,flags=re.M)
 body=re.sub(r'^if __name__.*$', '', body, flags=re.M)
 body=body.replace("json.loads((ROOT/'data/fuels.json').read_text())",repr(read('data/fuels.json')))
 body=body.replace("json.loads((ROOT/'data/furnace-model.json').read_text())",'BUNDLED_MODEL')
 if model=='furnace-skin-temp':header+='BUNDLED_MODEL = _unpack('+packed(read('data/furnace-model.json'))+')\n'
 shared=common.replace('from zoneinfo import ZoneInfo\n','')
 alerts=re.sub(r'^from common import .*\n','',(source/'alerts.py').read_text(),flags=re.M)
 adapter=(source/'adapter.py').read_text()
 tail=f'''
if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        try:
            payload = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
            output = run(payload)
        except (OSError, ValueError) as exc:
            output = {{'ok': False, 'errors': [{{'code': 'INVALID_JSON', 'message': str(exc)}}]}}
        print(json.dumps(clean(output), ensure_ascii=False, allow_nan=False))
        sys.exit(0 if output['ok'] else 1)
    else:
        SAMPLE['config'] = SETTINGS
        output = run(SAMPLE)
        destination = Path(__file__).with_name('{module}_results.json')
        destination.write_text(json.dumps(clean(output), indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        print('Example calculation ' + ('completed.' if output['ok'] else 'failed; see errors in results.'))
        print('Results saved to:', destination)
        print('Edit SETTINGS near the top of this file, then run again.')
        if not output['ok']: sys.exit(1)
'''
 text=header+'\n# Repeated in each standalone file: input validation, units and time handling.\n'+shared+'\n'+alerts+'\n'+adapter+'\n# MODEL CALCULATIONS\n'+body+tail
 destination=package/f'engines/{module}_engine.py'
 if '--check' in sys.argv:
  assert destination.read_text(encoding='utf-8') == text, f'Stale standalone file: {destination}'
 else: destination.write_text(text,encoding='utf-8')
print('Built six standalone engines')
