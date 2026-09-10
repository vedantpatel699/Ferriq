import importlib.util
import json
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
