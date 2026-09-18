"""Contract/quality safeguards and independent financial invariants."""
import copy
import importlib
import json
import subprocess
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'engines'))
from common import epoch
from adapter import map_records
from test_parity import MODULES, compare

def sample(model):return json.loads((ROOT/f'examples/{model}.input.json').read_text())
def run(payload):return importlib.import_module(MODULES[payload['model']]+'_engine').run(payload)

class Contract(unittest.TestCase):
    def test_examples_through_cli(self):
        for model,module in MODULES.items():
            with self.subTest(model=model):
                proc=subprocess.run([sys.executable,str(ROOT/f'engines/{module}_engine.py'),str(ROOT/f'examples/{model}.input.json')],capture_output=True,text=True,encoding='utf-8',cwd=ROOT)
                self.assertEqual(proc.returncode,0,proc.stderr)
                out=json.loads(proc.stdout);self.assertTrue(out['ok']);self.assertTrue(out['units'])
                compare(self,out['result'],json.loads((ROOT/f'examples/{model}.expected.json').read_text()))

    def test_reject_malformed_envelopes(self):
        for model in MODULES:
            p=sample(model);p['measurements']=p['measurements'][-1:]
            for patch in [{'schemaVersion':'9'},{'measurements':[]},{'config':None},{'timezone':'Not/AZone'}]:
                with self.subTest(model=model,patch=patch):
                    out=run({**p,**patch});self.assertFalse(out['ok']);self.assertEqual(out['errors'][0]['code'],'INVALID_INPUT')
            q=copy.deepcopy(p);q['measurements']*=2;self.assertFalse(run(q)['ok'])
            q=copy.deepcopy(p);q['measurements'][0]['values']['timestamp']='1900-01-01';self.assertFalse(run(q)['ok'])

    def test_quality_and_mapping(self):
        p=sample('shell-tube-exchanger');field='hotInC'
        p['measurements'][0]['quality']={field:'bad'}
        out=run(p);self.assertTrue(out['ok']);self.assertIsNone(out['result'][0]['uDirtyWm2k']);self.assertEqual(out['warnings'][0]['quality'],'bad')
        q=copy.deepcopy(p);q['measurements'][0]['values'][field]=None;q['measurements'][0].pop('quality')
        compare(self,out['result'],run(q)['result'])
        p['measurements'][0]['quality'][field]='invented';self.assertFalse(run(p)['ok'])
        record={'timestamp':'2026-09-17T12:00:00-06:00','tags':{'TI':{'unit':'degC','value':300,'quality':'good'}}}
        mapped=map_records('shell-tube-exchanger',[record],{'TI':{'field':field,'unit':'degC'}})
        self.assertEqual(mapped['measurements'][0]['values'][field],300)
        with self.assertRaises(ValueError):map_records('shell-tube-exchanger',[record],{'TI':{'field':field,'unit':'degF'}})

    def test_dst_elapsed_and_ambiguity(self):
        self.assertEqual((epoch('2026-03-08T03:00:00-06:00')-epoch('2026-03-08T01:00:00-07:00'))/3600000,1)
        for t in ['2026-03-08T02:30:00','2025-11-02T01:30:00']:
            with self.assertRaises(ValueError):epoch(t)
        p=sample('fired-heater');p['window']={'start':'2026-09-18','end':'2026-09-17'};self.assertFalse(run(p)['ok'])

    def test_invalid_configuration(self):
        checks={'air-blower':{'settings':{'powerFactor':0}},'fired-heater':{'radiationLossPct':-1},'shell-tube-exchanger':{'nShell':1.5},'membrane-analyzer':{'designFeedPressureKpag':-1},'furnace-skin-temp':{'pass':99},'crude-to-profit':{'opexRevenuePercent':101}}
        for model,config in checks.items():
            with self.subTest(model=model):
                p=sample(model);p['config']=config;self.assertFalse(run(p)['ok'])

    def test_opex_once_and_negative_flows(self):
        p=sample('crude-to-profit');p['config']['opexRevenuePercent']=8
        e=run(p)['result'][0]['economics']
        self.assertAlmostEqual(e['operating_costs']['cadPerOperatingHour'],e['revenue_low_cad_hr']*.08)
        self.assertAlmostEqual(e['margin_low_cad_hr'],e['revenue_low_cad_hr']-e['crude_cost_low_cad_hr'])
        p['measurements'][0]['values']['flows']['OSH']=-1;self.assertFalse(run(p)['ok'])

    def test_overlapping_financial_intervals_rejected(self):
        p=sample('crude-to-profit');a=p['measurements'][0]
        a['values']['intervalEnd']='2026-09-18T17:00:00-06:00'
        b=copy.deepcopy(a);b['timestamp']='2026-09-18T12:00:00-06:00'
        p['measurements']=[a,b];p['parameters']['priceCase']='low'
        self.assertFalse(run(p)['ok'])

if __name__=='__main__':unittest.main()
