import importlib.util
import json
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('refresh', ROOT / 'scripts/fetch-market-prices.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

class RefreshTest(unittest.TestCase):
    def test_failure_keeps_prices_and_original_dates(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'prices.json'
            original = json.loads((ROOT / 'public/data/crude-market-prices.json').read_text(encoding='utf-8'))
            output.write_text(json.dumps(original), encoding='utf-8')
            with patch.object(refresh, 'OUTPUT', output), patch.object(refresh, 'fetch', side_effect=ValueError('upstream unavailable')):
                refresh.main()
            result = json.loads(output.read_text(encoding='utf-8'))
            for key in ['crude', 'product', 'generatedAt', 'date', 'provenance']:
                self.assertEqual(result[key], original[key])
            self.assertFalse(result['refresh']['ok'])

    def test_failure_without_a_snapshot_cannot_publish_prices(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'prices.json'
            with patch.object(refresh, 'OUTPUT', output), patch.object(refresh, 'fetch', side_effect=ValueError()), self.assertRaises(SystemExit):
                refresh.main()
            self.assertFalse(output.exists())

    def test_cached_monthly_differential_preserves_date_and_uses_daily_wti(self):
        fixture = json.loads((ROOT / 'public/data/crude-market-prices.json').read_text(encoding='utf-8'))
        fx = io.BytesIO(json.dumps({'observations':[{'d':'2026-09-10','FXUSDCAD':{'v':'1.38'}}]}).encode())
        unavailable = {'ok':False,'value':None,'source':'unavailable'}
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'prices.json'
            output.write_text(json.dumps(fixture), encoding='utf-8')
            with patch.object(refresh,'OUTPUT',output), patch.object(refresh.urllib.request,'urlopen',return_value=fx), patch.object(refresh.E,'fetch_alberta_oil_prices',return_value=unavailable) as monthly, patch.object(refresh.E,'fetch_wti_usd_bbl',return_value={'ok':True,'value':90,'source':'eia','detail':'2026-09-09'}), patch.object(refresh.E,'product_market_values_cad_m3',return_value=(fixture['product'],fixture['provenance']['product'])):
                result = refresh.fetch()
                self.assertIs(refresh.E.fetch_alberta_oil_prices, monthly)
            self.assertEqual(result['provenance']['crude']['wti_date'],'2026-09-09')
            self.assertEqual(result['provenance']['crude']['differential_date'],fixture['provenance']['crude']['differential_date'])
            self.assertAlmostEqual(result['provenance']['crude']['wcs_usd_bbl'],90+fixture['provenance']['crude']['wcs_wti_differential'])
            self.assertEqual(len(result['cachedSources']),1)

    def test_success_replaces_failed_refresh_marker(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'prices.json'
            fixture = json.loads((ROOT / 'public/data/crude-market-prices.json').read_text(encoding='utf-8'))
            fixture['refresh'] = {'ok': False, 'attemptedAt': '2020-01-01T00:00:00+00:00'}
            with patch.object(refresh, 'OUTPUT', output), patch.object(refresh, 'fetch', return_value=fixture):
                refresh.main()
            self.assertTrue(json.loads(output.read_text(encoding='utf-8'))['refresh']['ok'])

if __name__ == '__main__':
    unittest.main()
