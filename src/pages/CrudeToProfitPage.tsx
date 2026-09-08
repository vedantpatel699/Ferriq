import { useMemo, useState } from "react";
import { useResource, useWorkspace } from "../lib/WorkspaceContext";
import {
  CRUDES,
  PRODUCTS,
  DEFAULT_CRUDE_TO_PROFIT_CONFIG,
  RESIDUE_UNIT_LABELS,
  GAS_OIL_UNIT_LABELS,
  type CrudeCode,
  type ProductCode,
  type ResidueUnit,
  type GasOilUnit,
} from "../engineering/crudeToProfit/data";
import { runModel } from "../engineering/crudeToProfit/calculations";
import { ConfigEditor, type ConfigValue } from "../components/ConfigEditor";
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
    [note, setNote] = useState(""),
    [pending, setPending] = useState<Market | null>(null);
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
            draft.market?.crude ?? null,
            draft.market?.product ?? null,
            draft.residueUnit,
            draft.gasOilUnit,
          )
        : null,
    [draft, valid.data],
  );
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
        Original refinery yield and gross margin calculation. Draft inputs
        recalculate immediately; save to retain this scenario. Prices are CAD/m³
        and flows are m³/h.
      </p>
      <div className="page-tabs" role="group" aria-label="Economics views">
        {[
          "Overview",
          "Configuration",
          "Price snapshot",
          "Detailed results",
          "Engineering manual",
        ].map((t) => (
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
          <div className="context-grid">
            {CRUDES.map((c) => (
              <label className="editor-field" key={c}>
                {c} (m³/h)
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={Number.isFinite(draft.flows[c]) ? draft.flows[c] : ""}
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
          <div className="action-bar">
            <label>
              Residue unit
              <select
                value={draft.residueUnit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    residueUnit: e.target.value as ResidueUnit,
                  }))
                }
              >
                {Object.entries(RESIDUE_UNIT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gas-oil unit
              <select
                value={draft.gasOilUnit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    gasOilUnit: e.target.value as GasOilUnit,
                  }))
                }
              >
                {Object.entries(GAS_OIL_UNIT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {result && (
            <>
              <h2>Gross margin</h2>
              <div className="metrics-grid">
                {[
                  ["Low", result.economics.margin_low_cad_hr],
                  ["High", result.economics.margin_high_cad_hr],
                  ...(result.economics.has_market_case
                    ? [
                        [
                          "Imported snapshot",
                          result.economics.margin_market_cad_hr,
                        ],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <article className="metric-card" key={String(label)}>
                    <h3>{label} case</h3>
                    <p className="metric-value">
                      {formatNumber(value, 0)} <small>CAD/h</small>
                    </p>
                  </article>
                ))}
              </div>
              <p>
                This is product revenue less crude feed cost; operating, capital
                and other costs are not deducted. Low/high labels retain the
                original paired price scenarios.
              </p>
              <DataTable
                rows={PRODUCTS.map((p) => ({
                  product: p,
                  flowM3Hr: result.product_slate_m3hr[p],
                  workbookFlowM3Hr: result.workbook_slate_m3hr[p],
                }))}
                caption="Product slate (including recovered LPG)"
              />
              <DataTable
                rows={flatten(result.blend)}
                caption="Crude blend properties"
              />
            </>
          )}
        </>
      )}
      {tab === "Configuration" && (
        <>
          <h2>Model configuration</h2>
          <p>
            Yield fractions, properties, conversion assumptions, and fixed price
            cases from the HTML workbook.
          </p>
          <ConfigEditor
            value={draft.config as unknown as ConfigValue}
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                config: v as unknown as Scenario["config"],
              }))
            }
          />
        </>
      )}
      {tab === "Price snapshot" && (
        <>
          <h2>Import an explicit price case</h2>
          <p>
            No external market service is called. Provide a complete dated price
            snapshot in CAD/m³. All five crudes and seven products are required
            before a snapshot can be applied.
          </p>
          {draft.market && (
            <p>
              Applied: {draft.market.date} · {draft.market.source} ·{" "}
              {draft.market.unit}
            </p>
          )}
          <button
            onClick={() =>
              downloadFile(
                "price-snapshot-template.json",
                JSON.stringify(
                  {
                    date: new Date().toISOString().slice(0, 10),
                    source: "Replace with your verified source",
                    currency: "CAD",
                    unit: "CAD/m3",
                    crude: draft.config.crude_price_low_cad_m3,
                    product: draft.config.product_price_low_cad_m3,
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Download snapshot template
          </button>
          <label>
            Import snapshot JSON
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1000000)
                    throw Error("Maximum snapshot size is 1 MB.");
                  const market = JSON.parse(await f.text());
                  validateResource("economics", { ...draft, market });
                  setPending(market);
                  setNote(
                    "Validated; review before applying to the draft scenario.",
                  );
                } catch (e) {
                  setPending(null);
                  setNote((e as Error).message);
                }
              }}
            />
          </label>
          {pending && (
            <>
              <DataTable
                rows={flatten(pending)}
                caption="Imported price snapshot preview"
              />
              <button
                onClick={() => {
                  setDraft((d) => ({ ...d, market: pending }));
                  setPending(null);
                  setNote(
                    "Snapshot applied to draft. Save scenario to retain it.",
                  );
                }}
              >
                Apply snapshot
              </button>
              <button onClick={() => setPending(null)}>Cancel</button>
            </>
          )}
          <button
            disabled={!draft.market}
            onClick={() => setDraft((d) => ({ ...d, market: null }))}
          >
            Remove snapshot from draft
          </button>
        </>
      )}
      {tab === "Detailed results" && result && (
        <>
          {Object.entries(result).map(([key, value]) => (
            <details key={key} open={key === "economics"}>
              <summary>{key.replaceAll("_", " ")}</summary>
              <DataTable
                rows={flatten(value)}
                caption={key.replaceAll("_", " ")}
              />
            </details>
          ))}
        </>
      )}
      {tab === "Engineering manual" && (
        <>
          <p>
            All four conversion-unit combinations use the original calculation
            engine. Current selected units:{" "}
            {RESIDUE_UNIT_LABELS[draft.residueUnit]} and{" "}
            {GAS_OIL_UNIT_LABELS[draft.gasOilUnit]}. Live price fetching
            described in the source manual is replaced here by validated,
            manually applied snapshots.
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
                  inputs: draft,
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
