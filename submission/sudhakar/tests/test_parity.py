"""Offline comparisons against captured production-TypeScript outputs.

Exact keys, lists, nulls, booleans and text. Numeric tolerance is 1e-9 relative
or absolute (floating-point operation ordering, not engineering uncertainty).
Display rounding is compared separately at the dashboard table's four decimal
places. Fixtures are regenerated from real TypeScript, never from Python.
"""
from decimal import Decimal, ROUND_HALF_UP
import gzip
import importlib
import json
import math
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'engines'))
MODULES={'air-blower':'air_blower','fired-heater':'fired_heater','shell-tube-exchanger':'shell_tube_exchanger','membrane-analyzer':'membrane_analyzer','furnace-skin-temp':'furnace_skin_ti_predictor','crude-to-profit':'crude_to_profit'}

def compare(test,actual,expected,path='result'):
    if isinstance(expected,bool) or expected is None or isinstance(expected,str):
        test.assertEqual(actual,expected,path);return
    if isinstance(expected,(int,float)):
        test.assertIsInstance(actual,(int,float),path)
        test.assertFalse(isinstance(actual,bool),path)
        test.assertTrue(math.isclose(actual,expected,rel_tol=1e-9,abs_tol=1e-9),f'{path}: {actual} != {expected}')
        return
    if isinstance(expected,list):
        test.assertIsInstance(actual,list,path);test.assertEqual(len(actual),len(expected),path)
        for i,(a,b) in enumerate(zip(actual,expected)):compare(test,a,b,f'{path}[{i}]')
    else:
        test.assertEqual(set(actual),set(expected),path)
        for k,v in expected.items():compare(test,actual[k],v,path+'.'+k)

def display(value,digits):
    if not isinstance(value,(int,float)) or not math.isfinite(value):return '\u2014'
    d=Decimal(str(value)).quantize(Decimal(1).scaleb(-digits),rounding=ROUND_HALF_UP)
    text=format(d,',.'+str(digits)+'f')
    return text.rstrip('0').rstrip('.') if '.' in text else text

class Parity(unittest.TestCase):
    def test_website_calculations(self):
        cases=json.loads(gzip.decompress((ROOT/'tests/website-cases.json.gz').read_bytes()))
        for case in cases:
            model=case['input']['model']
            with self.subTest(model=model,case=case['name']):
                engine=importlib.import_module(MODULES[model]+'_engine')
                result=engine.run(case['input'])
                self.assertTrue(result['ok'],str(result))
                compare(self,result['result'],case['expected'])
                if 'window' in case:compare(self,result['window'],case['window'],'window')
                for cell in case['display']:
                    value=result['result']
                    for key in cell['path']:value=value[key]
                    self.assertEqual(display(value,cell['digits']),cell['text'],str(cell['path']))

if __name__=='__main__':unittest.main()
