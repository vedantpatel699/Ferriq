import { BuildReport } from "../components/BuildReport";
import { useMemo, useState } from "react";
import { useResource, useWorkspace } from "../lib/WorkspaceContext";
import {
  CRUDES,
  PRODUCTS,
  HOURS_PER_DAY,
  OPERATING_DAYS_PER_YEAR,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG,
  RESIDUE_UNIT_LABELS,
  GAS_OIL_UNIT_LABELS,
  type CrudeCode,
  type ProductCode,
  type ResidueUnit,
  type GasOilUnit,
} from "../engineering/crudeToProfit/data";
import { runModel } from "../engineering/crudeToProfit/calculations";
import { MarketSnapshot } from "../components/MarketSnapshot";
import { useLiveMarket } from "../lib/liveMarket";
import { DataTable } from "../components/DataTable";
import { ReferenceManual } from "../components/ReferenceManual";
import { formatNumber } from "../lib/format";
import { downloadFile } from "../lib/files";
import { validateResource } from "../shared/workspace";
interface Market {
  date: string;
  source: string;
  currency: "CAD";
  unit: "CAD/m3";
  crude: Record<CrudeCode, number>;
  product: Record<ProductCode, number>;
}
interface Scenario {
  flows: Record<CrudeCode, number>;
  config: typeof DEFAULT_CRUDE_TO_PROFIT_CONFIG;
  residueUnit: ResidueUnit;
  gasOilUnit: GasOilUnit;
  market: Market | null;
}
function flatten(value: unknown, path = ""): Record<string, unknown>[] {
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) =>
      flatten(v, path ? path + "." + k : k),
    );
  return [{ quantity: path, value }];
}
export function CrudeToProfitPage() {
  const { data, version } = useResource<Scenario>("economics"),
    { save, reset, published } = useWorkspace();
  const [draft, setDraft] = useState<Scenario>(structuredClone(data)),
    [draftVersion, setDraftVersion] = useState(version),
    [tab, setTab] = useState("Overview"),
    [note, setNote] = useState("");
  const live = useLiveMarket();
  const market = live.market;
  const valid = useMemo(() => {
    try {
      return {
        data: validateResource("economics", draft) as Scenario,
        error: "",
      };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }, [draft]);
  const result = useMemo(
    () =>
      valid.data
        ? runModel(
            draft.flows,
            draft.config,
            market?.crude ?? null,
            market?.product ?? null,
            draft.residueUnit,
            draft.gasOilUnit,
          )
        : null,
    [draft, valid.data, market],
  );
  const annualFactor = (HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR) / 1e6;
  const annualCases = result
    ? [
        {
          label: "Low",
          margin: result.economics.margin_low_mcad_yr,
          sales: result.economics.revenue_low_cad_hr * annualFactor,
        },
        {
          label: "High",
          margin: result.economics.margin_high_mcad_yr,
          sales: result.economics.revenue_high_cad_hr * annualFactor,
        },
        {
          label: "Live market",
          margin: result.economics.margin_market_mcad_yr,
          sales:
            result.economics.revenue_market_cad_hr == null
              ? undefined
              : result.economics.revenue_market_cad_hr * annualFactor,
        },
      ]
    : [];
  async function persist() {
    try {
      await save("economics", draft, "economics scenario", draftVersion);
      setDraftVersion(draftVersion + 1);
      setNote("Scenario saved in this browser.");
    } catch (e) {
      setNote((e as Error).message);
    }
  }
  return (
    <>
      <h1>Crude to Profit</h1>
      <p>The data were obtained from open resources.</p>
      {result && (
        <div className="action-bar">
          <BuildReport
            asset="Crude to Profit"
            source={
              "Scenario version " +
              draftVersion +
              (market
                ? " · price snapshot " + market.date + " " + market.source
                : " · fixed workbook price cases")
            }
            summary={
              annualCases
                .map(
                  (c) =>
                    `${c.label}: annual gross margin ${formatNumber(c.margin, 2)}; annual sales revenue ${formatNumber(c.sales, 2)} million CAD/year`,
                )
                .join(". ") +
              ". Workbook basis: 24 hours/day × 330 operating days/year. Operating and capital costs are excluded."
            }
            period="Current draft scenario"
            quality={[
              "Scenario inputs are assumptions, not live process observations.",
              `${RESIDUE_UNIT_LABELS[draft.residueUnit]} + ${GAS_OIL_UNIT_LABELS[draft.gasOilUnit]}; once-through illustrative yields.`,
              `Unpriced residue: ${formatNumber(result.unpriced_residue_m3hr, 2)} m�/h; no sales credit.`,
              "FCC gasoline uses naphtha pricing; LCO/slurry and bypassed gas oil use UCO pricing. Pretreatment, product-quality discounts and recycle are excluded.",
            ]}
            rows={PRODUCTS.map((p) => ({
              product: p.replaceAll("_", " "),
              flowM3Hr: result.product_slate_m3hr[p],
            }))}
          />
        </div>
      )}

      <p>
        Original refinery yield and gross margin calculation. The saved scenario
        loads automatically. Expand Adjust scenario to explore alternatives,
        then save to retain changes. Prices are CAD/m³ and flows are m³/h.
      </p>
      <div className="page-tabs" role="group" aria-label="Economics views">
        {["Overview", "Price snapshot", "Engineering manual"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {note && <p role="status">{note}</p>}
      {valid.error && <p role="alert">{valid.error}</p>}
      {tab === "Overview" && (
        <>
          <h2>Crude blend</h2>
          <div className="read-only-inputs">
            {CRUDES.map((c) => (
              <span key={c}>
                <strong>{c}</strong> {formatNumber(draft.flows[c], 1)} m³/h
              </span>
            ))}
          </div>
          <p>
            {RESIDUE_UNIT_LABELS[draft.residueUnit]} ·{" "}
            {GAS_OIL_UNIT_LABELS[draft.gasOilUnit]}
          </p>
          <div className="context-grid">
            <label className="editor-field">
              Residue conversion
              <select
                aria-label="Residue conversion"
                value={draft.residueUnit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    residueUnit: e.target.value as ResidueUnit,
                  }))
                }
              >
                {Object.entries(RESIDUE_UNIT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-field">
              Gas-oil conversion
              <select
                aria-label="Gas-oil conversion"
                value={draft.gasOilUnit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    gasOilUnit: e.target.value as GasOilUnit,
                  }))
                }
              >
                {Object.entries(GAS_OIL_UNIT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            Vacuum residue enters the residue unit. Straight-run VGO and
            generated gas oil enter the selected gas-oil unit independently.
            These are illustrative once-through estimates; feed treatment and
            unit suitability require confirmation.
          </p>
          <details className="advanced-panel">
            <summary>Adjust scenario</summary>
            <div className="context-grid">
              {CRUDES.map((c) => (
                <label className="editor-field" key={c}>
                  {c} (m³/h)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={
                      Number.isFinite(draft.flows[c]) ? draft.flows[c] : ""
                    }
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        flows: { ...d.flows, [c]: e.target.valueAsNumber },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          {result && (
            <>
              {draft.config.lpg_fuel_gas_recovered > 0 && (
                <p role="status">
                  This saved scenario credits{" "}
                  {formatNumber(draft.config.lpg_fuel_gas_recovered * 100, 0)}%
                  of combined residue gas as saleable LPG. Recovery is
                  unverified. Restore the published scenario to use the revised
                  zero-credit default.
                </p>
              )}
              {result.unpriced_residue_m3hr > 0 && (
                <p role="status">
                  Unpriced residue:{" "}
                  {formatNumber(result.unpriced_residue_m3hr, 2)} m³/h. This
                  inventory receives no sales credit. Annual estimates exclude
                  its potential value.
                </p>
              )}
              <h2>Annual estimate</h2>
              <p>
                Workbook basis: {HOURS_PER_DAY} hours/day ×{" "}
                {OPERATING_DAYS_PER_YEAR} operating days/year (
                {HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR} hours/year).
              </p>
              <div className="metrics-grid">
                {annualCases.map(({ label, margin, sales }) => (
                  <article className="metric-card" key={label}>
                    <h3>{label} case</h3>
                    <p>Annual gross margin</p>
                    <p className="metric-value">
                      {formatNumber(margin, 2)} <small>million CAD/year</small>
                    </p>
                    <p>
                      Annual sales revenue:{" "}
                      <strong>{formatNumber(sales, 2)}</strong> million CAD/year
                    </p>
                  </article>
                ))}
              </div>
              <p>
                {market
                  ? `Live market uses published estimates from ${market.date}; see Price snapshot for older source dates and proxy assumptions.`
                  : live.status}
              </p>
              <p>
                The Excel annual figure (H54/H55) is gross margin: product sales
                revenue less crude feed cost, multiplied by 24 × 330 ÷
                1,000,000. Annual sales revenue above is before crude cost.
                Operating, capital and other costs are not deducted; these are
                not net-profit estimates. Low/High retain the client’s paired
                price scenarios.
              </p>
              <DataTable
                rows={PRODUCTS.map((p) => ({
                  product: p.replaceAll("_", " "),
                  flowM3Hr: result.product_slate_m3hr[p],
                }))}
                caption="Valued product pools (including recovered LPG)"
              />
              <details className="advanced-panel">
                <summary>Feed routing and yield assumptions</summary>
                <DataTable
                  caption="Stream transfers by stage (do not sum across stages)"
                  rows={result.routing}
                />
                <p>
                  Residue-unit coke:{" "}
                  {formatNumber(result.byproducts.coke_kghr, 1)} kg/h. FCC coke
                  burned internally:{" "}
                  {formatNumber(result.gas_oil_byproducts.coke_kghr, 1)} kg/h.
                  Neither receives sales credit. Gas without verified LPG
                  recovery receives no sales credit.
                </p>
                <DataTable
                  caption="Selected residue-unit mass yields"
                  rows={Object.entries(result.byproducts.yield_wtpct).map(
                    ([cut, yieldPct]) => ({
                      cut: cut.replaceAll("_", " "),
                      wtPct: yieldPct,
                    }),
                  )}
                />
                <p>
                  LC Finer: the revised sheet adds 11.99 wt% LPG/fuel gas; the
                  mass yields now total 100%. This is combined gas, not a
                  measured recoverable LPG fraction. The current scenario
                  credits{" "}
                  {formatNumber(draft.config.lpg_fuel_gas_recovered * 100, 0)}%
                  as LPG. The revised default credits none until recovery is
                  established.
                </p>
                <p>
                  Delayed coker: at 15 wt% feed CCR, the correlation gives
                  16.435% naphtha, 9.96% gas, 24% coke and 49.605% gas oils. Gas
                  oils remain one pool because the light/heavy split is unknown.
                  LC Finer ratios are not used. These are illustrative
                  assumptions, not measured yields.
                </p>
                <p>
                  FCC: the sheet’s ranges total only 48–93 wt%, including about
                  5% light gas. They cannot define a closed mass balance. The
                  retained illustrative slate is 47% gasoline, 21% LCO, 10%
                  slurry, 12% LPG, 4% dry gas and 6% coke. It totals 100%, but
                  does not match every client range.
                </p>
                <p>
                  FCC processes the gas-oil stream; LC Finer or coker processes
                  vacuum residue. FCC gasoline uses the naphtha price proxy; LCO
                  and slurry use the UCO price proxy. FCC does not create
                  finished jet/diesel by boiling-range allocation. Bypassed gas
                  oil also uses the UCO price proxy. Treatment costs and
                  product-quality discounts are excluded.
                </p>
                <p>
                  Source assay yields are retained without normalization.
                  Hydrocracker liquid volume gain is retained. The model
                  corrects SimDist!AA10, which references Z9 rather than AA9 and
                  omits direct naphtha in the sheet. Routing now includes all LC
                  Finer gas-oil fractions and explicitly holds unconverted
                  residue. The annual formula and fixed prices follow the sheet,
                  but revised routing changes the product quantities.
                  Hydrocracker yields are fixed screening assumptions; coker gas
                  oil may need pretreatment. Serial conversion and recycle are
                  not modeled.
                </p>
              </details>
              <details className="advanced-panel">
                <summary>Crude blend properties</summary>
                <DataTable
                  rows={flatten(result.blend)}
                  caption="Crude blend properties"
                />
              </details>
            </>
          )}
        </>
      )}
      {tab === "Price snapshot" && <MarketSnapshot {...live} />}
      {tab === "Engineering manual" && (
        <>
          <p>
            Nine independent routing combinations use the revised screening
            model. Current selected units:{" "}
            {RESIDUE_UNIT_LABELS[draft.residueUnit]} and{" "}
            {GAS_OIL_UNIT_LABELS[draft.gasOilUnit]}. Live prices use the
            original Python pricing method, fetched during website publication
            with dated source observations.
          </p>
          <ReferenceManual id="crude-to-profit" />
        </>
      )}
      <div className="action-bar">
        <button disabled={!result} onClick={() => void persist()}>
          Save scenario
        </button>
        <button
          onClick={() => {
            setDraft(structuredClone(data));
            setDraftVersion(version);
            setNote("Discarded unsaved draft changes.");
          }}
        >
          Discard draft changes
        </button>
        <button
          onClick={async () => {
            try {
              await reset("economics");
              setDraftVersion(1);
              setDraft(
                structuredClone(
                  published.find((r) => r.key === "economics")!
                    .data as Scenario,
                ),
              );
              setNote("Published scenario restored.");
            } catch (e) {
              setNote((e as Error).message);
            }
          }}
        >
          Restore published scenario
        </button>
        <button
          disabled={!result}
          onClick={() =>
            downloadFile(
              "crude-to-profit-scenario.json",
              JSON.stringify(
                {
                  inputs: { ...draft, market },
                  results: result,
                  configurationVersion: version,
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          Export scenario & results
        </button>
      </div>
    </>
  );
}
