import { OpexConfiguration } from "../components/OpexConfiguration";
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
  GRACE_FCC_REFERENCE,
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
    { save, reset, published, readOnly } = useWorkspace();
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
          opex: result.economics.operating_costs,
          margin: result.economics.margin_low_mcad_yr,
          afterOpex: result.economics.margin_after_opex_low_mcad_yr,
          feed:
            result.economics.crude_cost_low_cad_hr == null
              ? undefined
              : result.economics.crude_cost_low_cad_hr * annualFactor,
          sales: result.economics.revenue_low_cad_hr * annualFactor,
        },
        {
          label: "High",
          opex: result.economics.operating_costs_high,
          margin: result.economics.margin_high_mcad_yr,
          afterOpex: result.economics.margin_after_opex_high_mcad_yr,
          feed:
            result.economics.crude_cost_high_cad_hr == null
              ? undefined
              : result.economics.crude_cost_high_cad_hr * annualFactor,
          sales: result.economics.revenue_high_cad_hr * annualFactor,
        },
        {
          label: "Live market",
          opex: result.economics.operating_costs_market,
          margin: result.economics.margin_market_mcad_yr,
          afterOpex: result.economics.margin_after_opex_market_mcad_yr,
          feed:
            result.economics.crude_cost_market_cad_hr == null
              ? undefined
              : result.economics.crude_cost_market_cad_hr * annualFactor,
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
      <p>
        All prices and yields come from open, public sources. See the
        Engineering manual tab for where each figure comes from.
      </p>
      {result && (
        <div className="action-bar">
          <BuildReport
            asset="Crude to Profit"
            source={
              "Scenario version " +
              draftVersion +
              (market
                ? " · price snapshot " + market.date + " " + market.source
                : " · fixed Low/High price cases")
            }
            summary={
              annualCases
                .map(
                  (c) =>
                    `${c.label}: annual gross margin ${formatNumber(c.margin, 2)}; margin after configured OPEX ${formatNumber(c.afterOpex, 2)}; annual sales revenue ${formatNumber(c.sales, 2)} million CAD/year`,
                )
                .join(". ") +
              ". Operating basis: 24 hours/day × 330 operating days/year. Configured operating costs are deducted once after gross margin. Capital, financing, depreciation, taxes and unconfigured costs are excluded."
            }
            period="Current draft scenario"
            quality={[
              "Scenario inputs are assumptions, not live process observations.",
              ...(draft.gasOilUnit === "fcc"
                ? [
                    `${GRACE_FCC_REFERENCE.source}; reported closure gap: ${formatNumber(result.gas_oil_byproducts.unallocated_kghr, 2)} kg/h, unpriced. Source: ${GRACE_FCC_REFERENCE.url}`,
                  ]
                : []),
              `${RESIDUE_UNIT_LABELS[draft.residueUnit]} + ${GAS_OIL_UNIT_LABELS[draft.gasOilUnit]}; once-through illustrative yields.`,
              `Unpriced residue: ${formatNumber(result.unpriced_residue_m3hr, 2)} m³/h; no sales credit.`,
              "FCC uses Grace Table 1 at 75% conversion. Naphtha includes FCC gasoline; Diesel includes LCO; Residue/UCO includes bottoms. These are price proxies. Pretreatment, quality discounts and recycle are excluded.",
            ]}
            rows={PRODUCTS.map((p) => ({
              product: p.replaceAll("_", " "),
              flowM3Hr: result.product_slate_m3hr[p],
            }))}
          />
        </div>
      )}

      <p>
        Refinery yield, gross margin and margin after configured OPEX. The saved
        scenario loads automatically. Expand Adjust scenario to explore
        alternatives, then save to retain changes. Prices are CAD/m³ and flows
        are m³/h.
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
          <OpexConfiguration
            value={draft.config.opexRevenuePercent}
            legacy={draft.config.opex !== undefined}
            onChange={(opexRevenuePercent) =>
              setDraft((d) => ({
                ...d,
                config: { ...d.config, opexRevenuePercent },
              }))
            }
          />
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
              {draft.gasOilUnit === "fcc" && (
                <p role="status">
                  FCC uses a Grace pilot-plant reference, not a feed-specific
                  prediction. Naphtha includes FCC gasoline; Diesel includes
                  light cycle oil (LCO), which needs treatment for finished
                  diesel. The reference leaves 0.2 wt% unallocated with no sales
                  credit.
                </p>
              )}
              <h2>Annual estimate</h2>
              <p>
                Operating basis: {HOURS_PER_DAY} hours/day ×{" "}
                {OPERATING_DAYS_PER_YEAR} operating days/year (
                {HOURS_PER_DAY * OPERATING_DAYS_PER_YEAR} hours/year).
              </p>
              <div className="metrics-grid">
                {annualCases.map(({ label, margin, sales, afterOpex }) => (
                  <article className="metric-card" key={label}>
                    <h3>{label} case</h3>
                    <p>Margin after configured OPEX</p>
                    <p className="metric-value">
                      {formatNumber(afterOpex, 2)}{" "}
                      <small>million CAD/year</small>
                    </p>
                    <p>
                      Annual gross margin:{" "}
                      <strong>{formatNumber(margin, 2)}</strong> million
                      CAD/year
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
                Gross margin is sales revenue minus crude feed cost. Operating
                margin also deducts configured OPEX. Unconfigured expenses,
                depreciation, financing, tax and capital expenditure are
                excluded. All annual amounts are shown in million CAD. Low and
                High use their respective price assumptions.
              </p>
              <DataTable
                caption="Annual profit reconciliation (million CAD/year)"
                rows={annualCases.map((c) => ({
                  case: c.label,
                  sales: c.sales,
                  crudePurchases: c.feed,
                  grossMargin: c.margin,
                  configuredOpex: c.opex ? c.opex.annualCad / 1e6 : undefined,
                  marginAfterOpex: c.afterOpex,
                }))}
              />
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
                  LC Finer residue includes 11.99 wt% LPG/fuel gas, so the mass
                  yields total 100%. This is combined gas, not a measured
                  recoverable LPG fraction. The current scenario credits{" "}
                  {formatNumber(draft.config.lpg_fuel_gas_recovered * 100, 0)}%
                  of it as saleable LPG; the default credits none until a
                  recovery fraction is confirmed.
                </p>
                <p>
                  Delayed coker: at 15 wt% feed CCR, the correlation gives
                  16.435% naphtha, 9.96% gas, 24% coke and 49.605% gas oils. Gas
                  oils remain one pool because the light/heavy split is unknown.
                  LC Finer ratios are not used. These are illustrative
                  assumptions, not measured yields.
                </p>
                <p>
                  FCC now uses{" "}
                  <a
                    href={GRACE_FCC_REFERENCE.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Grace Table 1, printed page 48
                  </a>
                  , at 75 wt% conversion. The measured case uses resid feed and
                  deactivated MIDAS catalyst, with no recycle. It is the closest
                  of the four Table 1 cases to the five specification ranges
                  below by summed distance, but it does not match all of them.
                </p>
                <DataTable
                  caption="FCC reference yields against specification ranges (wt% of FCC feed)"
                  rows={[
                    {
                      category: "Naphtha",
                      sourceProduct: "Gasoline (C5–430°F)",
                      specRange: "15–25",
                      referenceWtPct: 51.9,
                    },
                    {
                      category: "Diesel",
                      sourceProduct: "Light cycle oil (430–650°F)",
                      specRange: "5–15",
                      referenceWtPct: 16.7,
                    },
                    {
                      category: "Residue / UCO",
                      sourceProduct: "Bottoms (650°F+)",
                      specRange: "5–15",
                      referenceWtPct: 8.6,
                    },
                    {
                      category: "LPG / Fuel gas",
                      sourceProduct: "LPG (saleable price proxy)",
                      specRange: "15–25 LPG",
                      referenceWtPct: 13.3,
                    },
                    {
                      category: "LPG / Fuel gas",
                      sourceProduct: "Dry gas (no sales credit)",
                      specRange: "Approximately 5",
                      referenceWtPct: 2.2,
                    },
                    {
                      category: "Coke",
                      sourceProduct: "Coke burned in regenerator",
                      specRange: "3–8",
                      referenceWtPct: 7.1,
                    },
                    {
                      category: "Unallocated balance",
                      sourceProduct: "Reported closure gap (no sales credit)",
                      specRange: "Not specified",
                      referenceWtPct: 0.2,
                    },
                  ]}
                />
                <p>
                  The reported yields total 99.8 wt%; the remaining 0.2 wt% is
                  tracked separately, not normalized into saleable products.
                  LVGO, MVGO and HVGO are not separately allocated: this model
                  retains the FCC bottoms pool. Grace's detailed boiling bins do
                  not establish this model's VGO cut boundaries.
                </p>
                <p>
                  Reference conditions: reactor exit 970°F, regenerator 1270°F,
                  feed preheat 299°F and catalyst/oil ratio 9.4. These identify
                  the source experiment, not recommended plant settings.
                  Applying this fixed case to straight-run, LC Finer or coker
                  gas oil requires feed-specific validation.
                </p>
                <p>
                  Naphtha and Diesel keep their usual price categories, but the
                  FCC contributions to them are gasoline and LCO proxies, not
                  certified finished products. Bottoms and bypassed gas oil use
                  the UCO price proxy. Treatment costs and quality discounts are
                  excluded. Liquid densities are model assumptions (LPG 560,
                  gasoline 730, LCO 950 and bottoms 1050 kg/m³), not Grace
                  measurements.
                </p>
                <p>
                  Source assay yields and hydrocracker liquid volume gain are
                  used as given, without normalization. Routing includes all LC
                  Finer gas-oil fractions and holds unconverted residue
                  separately rather than crediting it. Hydrocracker yields are
                  fixed screening assumptions; coker gas oil may need
                  pretreatment. Serial conversion and recycle between units are
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
            Nine independent routing combinations are available from the residue
            and gas-oil unit choices. Current selected units:{" "}
            {RESIDUE_UNIT_LABELS[draft.residueUnit]} and{" "}
            {GAS_OIL_UNIT_LABELS[draft.gasOilUnit]}. Live prices are refreshed
            once daily during publication, with dated source observations shown
            on the Price snapshot tab.
          </p>
          <ReferenceManual id="crude-to-profit" />
        </>
      )}
      <div className="action-bar">
        <button disabled={!result || readOnly} onClick={() => void persist()}>
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
          disabled={readOnly}
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
