import { type useLiveMarket } from "../lib/liveMarket";
import { CRUDES, PRODUCTS } from "../engineering/crudeToProfit/data";
import { DataTable } from "./DataTable";
import { formatNumber } from "../lib/format";
function datedStatus(value: string | null) {
  const stamp =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value) : NaN;
  return Number.isFinite(stamp) && Date.now() - stamp > 7 * 86400000
    ? "Older observation"
    : "See source dates";
}
export function MarketSnapshot({
  market,
  status,
  loading,
  refresh,
}: ReturnType<typeof useLiveMarket>) {
  return (
    <>
      <h2>Live market price snapshot</h2>
      <p>
        Public APIs are refreshed during the daily website publication. Reload
        retrieves the latest published snapshot. These are estimated
        refinery-gate prices, not executable quotes.
      </p>
      <button disabled={loading} onClick={() => void refresh()}>
        {loading ? "Loading prices…" : "Reload published prices"}
      </button>
      <p role="status">{status}</p>
      {market && (
        <>
          {!!market.cachedSources?.length && (
            <p role="status">
              Using previously verified monthly observations because a source
              was unavailable: {market.cachedSources.join(", ")}. Daily price
              drivers were fetched separately.
            </p>
          )}
          <p>
            Snapshot generated{" "}
            {market.generatedAt.slice(0, 19).replace("T", " ")} UTC. All prices
            in CAD/m³.
          </p>
          <p>
            WTI: {market.provenance.crude.wti_date}; Alberta WCS differential:{" "}
            {market.provenance.crude.differential_date}; Alberta NGL anchor:{" "}
            {market.provenance.product.alberta_ngl.anchor_month ??
              "unavailable, EIA proxy used"}
            ; USD/CAD: {formatNumber(market.provenance.fx.value, 4)} (
            {market.provenance.fx.date}).
          </p>
          <DataTable
            caption="Live crude estimates"
            rows={CRUDES.map((c) => ({
              crude: c,
              cadM3: market.crude[c],
              method:
                market.provenance.crude.provenance[c === "SCO" ? "OSA" : c]
                  ?.wording,
              spreadCalibration:
                market.provenance.crude.provenance[c === "SCO" ? "OSA" : c]
                  ?.calibrated_date,
            }))}
          />
          <DataTable
            caption="Live product estimates"
            rows={PRODUCTS.map((p) => ({
              product: p.replaceAll("_", " "),
              cadM3: market.product[p],
              method: market.provenance.product.detail[p].ui_label,
              observed:
                market.provenance.product.detail[p].freshness.observation_date,
              age: datedStatus(
                market.provenance.product.detail[p].freshness.observation_date,
              ),
            }))}
          />
          <details>
            <summary>Pricing assumptions and sources</summary>
            <p>
              Crude: WTI plus the signed Alberta WCS differential, then Claude’s
              configured grade spreads. LPG: Alberta propane/butanes anchors
              moved by EIA drivers. Naphtha: Alberta pentanes-plus proxy moved
              by EIA gasoline. Kerosene and diesel: EIA Gulf Coast benchmarks.
              Swing cuts: 50/50 destination values. UCO: 82.5% of the estimated
              WCS value. No prices are forced into the workbook’s Low/High
              range.
            </p>
            {PRODUCTS.map((p) => (
              <p key={p}>
                <strong>{p.replaceAll("_", " ")}: </strong>
                {market.provenance.product.detail[p].note}
              </p>
            ))}
            <p>
              <a href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm">
                EIA spot prices
              </a>{" "}
              ·{" "}
              <a href="https://economicdashboard.alberta.ca/dashboard/oil-prices/">
                Alberta oil prices
              </a>{" "}
              ·{" "}
              <a href="https://open.alberta.ca/publications/reference-price-calculations">
                Alberta NGL reference prices
              </a>{" "}
              ·{" "}
              <a href="https://www.bankofcanada.ca/valet/docs/">
                Bank of Canada exchange rates
              </a>
            </p>
          </details>
        </>
      )}
    </>
  );
}
