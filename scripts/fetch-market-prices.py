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
    print('Fetching Bank of Canada exchange rate.')
    request = urllib.request.Request(fx_url, headers={'User-Agent': 'Ferriq/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=45) as response:
        observations = json.load(response)['observations']
    fx_row = next(row for row in reversed(observations) if row.get('FXUSDCAD', {}).get('v'))
    fx = float(fx_row['FXUSDCAD']['v'])
    if not math.isfinite(fx) or fx <= 0:
        raise ValueError('Invalid exchange rate')
    print('Exchange rate loaded; fetching crude estimates.')
    # Alberta publishes monthly. If its endpoint fails, retain the verified
    # monthly observation and date, while still requiring complete EIA prices.
    prior = json.loads(OUTPUT.read_text(encoding='utf-8')) if OUTPUT.exists() else {}
    cached_sources = []
    original_alberta = E.fetch_alberta_oil_prices
    def monthly_alberta(manual=None):
        row = original_alberta(manual)
        if row['ok']:
            return row
        old = prior.get('provenance', {}).get('crude', {})
        spread, date = old.get('wcs_wti_differential'), old.get('differential_date')
        if isinstance(spread, (int, float)) and math.isfinite(spread) and date:
            label = 'Alberta WCS differential (' + date + ')'
            if label not in cached_sources:
                cached_sources.append(label)
            return {'ok': True, 'value': {'Differential': (-spread, date)}, 'source': 'alberta_cached'}
        return row
    E.fetch_alberta_oil_prices = monthly_alberta
    try:
        crude, crude_meta = E.canadian_crude_prices_cad_m3(fx)
        print('Crude estimates available:', sum(v is not None for v in crude.values()))
        if not any(v is not None for v in crude.values()):
            print('WTI available:', crude_meta.get('wti', {}).get('value') is not None,
                  'Differential source:', crude_meta.get('differential_source', 'unknown'))
        product, product_meta = E.product_market_values_cad_m3(fx)
        print('Product estimates available:', sum(v is not None for v in product.values()))
    finally:
        E.fetch_alberta_oil_prices = original_alberta
    for keys, prices in [(E.CRUDES, crude), (E.PRODUCTS, product)]:
        if any(not isinstance(prices.get(k), (int, float)) or not math.isfinite(prices[k]) or prices[k] <= 0 for k in keys):
            raise ValueError('Incomplete upstream prices; retaining previous snapshot')
    now = datetime.now(timezone.utc).isoformat()
    return dict(cachedSources=cached_sources, date=now[:10], generatedAt=now, source='EIA, Government of Alberta and Bank of Canada; model-derived estimates', currency='CAD', unit='CAD/m3', crude=crude, product=product,
                provenance=dict(fx=dict(value=fx, date=fx_row['d'], source=fx_url), crude=crude_meta, product=product_meta))

def main():
    try:
        snapshot = fetch()
        snapshot["refresh"] = {"ok": True, "attemptedAt": datetime.now(timezone.utc).isoformat()}
        OUTPUT.write_text(json.dumps(snapshot, indent=2, allow_nan=False) + '\n', encoding='utf-8')
        print('Published complete dated snapshot: five crude estimates and seven product estimates.')
    except Exception as error:
        # Do not print upstream URLs/errors: an EIA request can contain credentials.
        print('Market refresh unavailable; existing snapshot and its original dates retained.')
        # Only exception type/status are safe: never log the URL or exception message.
        print('Failure type:', type(error).__name__, 'HTTP status:', getattr(error, 'code', 'not applicable'))
        if not OUTPUT.exists():
            sys.exit(1)
        prior = json.loads(OUTPUT.read_text(encoding='utf-8'))
        prior['refresh'] = {'ok': False, 'attemptedAt': datetime.now(timezone.utc).isoformat()}
        OUTPUT.write_text(json.dumps(prior, indent=2, allow_nan=False) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
