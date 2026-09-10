"""Publish Claude's pricing estimates as a static, dated GitHub Pages asset."""
from pathlib import Path
import sys, json, math, urllib.request
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python/crude_to_profit'))
import engine as E

OUTPUT = ROOT / 'public/data/crude-market-prices.json'

def fetch():
    fx_url = 'https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=10'
    with urllib.request.urlopen(fx_url, timeout=45) as response:
        observations = json.load(response)['observations']
    fx_row = next(row for row in reversed(observations) if row.get('FXUSDCAD', {}).get('v'))
    fx = float(fx_row['FXUSDCAD']['v'])
    if not math.isfinite(fx) or fx <= 0:
        raise ValueError('Invalid exchange rate')
    crude, crude_meta = E.canadian_crude_prices_cad_m3(fx)
    product, product_meta = E.product_market_values_cad_m3(fx)
    for keys, prices in [(E.CRUDES, crude), (E.PRODUCTS, product)]:
        if any(not isinstance(prices.get(k), (int, float)) or not math.isfinite(prices[k]) or prices[k] <= 0 for k in keys):
            raise ValueError('Incomplete upstream prices; retaining previous snapshot')
    now = datetime.now(timezone.utc).isoformat()
    return dict(date=now[:10], generatedAt=now, source='EIA, Government of Alberta and Bank of Canada; model-derived estimates', currency='CAD', unit='CAD/m3', crude=crude, product=product,
                provenance=dict(fx=dict(value=fx, date=fx_row['d'], source=fx_url), crude=crude_meta, product=product_meta))

def main():
    try:
        snapshot = fetch()
        snapshot["refresh"] = {"ok": True, "attemptedAt": datetime.now(timezone.utc).isoformat()}
        OUTPUT.write_text(json.dumps(snapshot, indent=2, allow_nan=False) + '\n', encoding='utf-8')
        print('Published complete dated snapshot: five crude estimates and seven product estimates.')
    except Exception:
        # Do not print upstream URLs/errors: an EIA request can contain credentials.
        print('Market refresh unavailable; existing snapshot and its original dates retained.')
        if not OUTPUT.exists():
            sys.exit(1)
        prior = json.loads(OUTPUT.read_text(encoding='utf-8'))
        prior['refresh'] = {'ok': False, 'attemptedAt': datetime.now(timezone.utc).isoformat()}
        OUTPUT.write_text(json.dumps(prior, indent=2, allow_nan=False) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
