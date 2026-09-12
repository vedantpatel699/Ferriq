import { createElement, type ReactNode } from "react";
import manuals from "../reference/manuals.json";
type Node = string | { tag: string; children: Node[]; href?: string };
function render(node: Node, key: number): ReactNode {
  if (typeof node === "string") return node;
  return createElement(
    node.tag,
    {
      key,
      ...(node.href
        ? { href: node.href, target: "_blank", rel: "noreferrer" }
        : {}),
    },
    ...node.children.map(render),
  );
}
export function ReferenceManual({ id }: { id: string }) {
  const nodes = (manuals as unknown as Record<string, Node[]>)[id] ?? [];
  return (
    <article className="reference-manual">
      <h2>Engineering manual & sources</h2>
      <p className="source-note">
        Preserved from the original HTML reference. Configuration and
        observation dates in the current workspace are shown separately.
        Reference limits are not operating instructions.
      </p>
      <section className="manual-current-edition">
        <h3>Current React edition</h3>
        <p>
          Calculations, source datasets and engineering content below follow the
          preserved HTML. Workspace configuration and observation dates shown on
          the page take precedence over example values. The left navigation
          stays fixed while the main content scrolls. Chart controls and
          accessible data tables support detailed review.
        </p>
        <p>
          Build Report opens a nonmodal drawer. Add engineer notes, preview the
          current values and visible charts, then Export PDF through the browser
          print dialog. Refresh the preview after changing the page. Published
          datasets are shared through GitHub Pages. Edits, imports and version
          history stay in this browser until a reviewed backup is published to
          Git.
        </p>
        {id === "crude-to-profit" && (
          <p>
            Annual figures use Excel’s 24 hours/day × 330 operating days/year.
            The main annual estimate is gross margin after crude cost; annual
            sales revenue is shown separately, both in million CAD/year. The
            revised workbook adds 11.99 wt% LC Finer LPG/fuel gas. The default
            now credits no additional saleable LPG without a verified recovery
            fraction. The AA10 naphtha correction remains. Low and High retain
            workbook prices; Live market uses Claude’s original Python pricing
            method through daily static publication, with source dates and proxy
            assumptions in Price snapshot. Residue and gas-oil conversion are
            independent, with bypass choices. Coker gas oil stays unsplit and
            unconverted residue has no sales credit. FCC uses Grace Table 1
            (printed p.48), the measured 75 wt% conversion case: gasoline 51.9,
            LCO 16.7, bottoms 8.6, LPG 13.3, dry gas 2.2 and coke 7.1 wt%. The
            0.2 wt% closure gap is unpriced. Client Naphtha, Diesel and
            Residue/UCO headings map to gasoline, LCO and bottoms, with explicit
            price and quality proxies. The pilot-plant reference is not a
            prediction calibrated to this feed. The source link, conditions and
            client-range comparison are on Overview. These current notes
            supersede the historical FCC calculation below. Configuration and
            Detailed results are hidden. The data were obtained from open
            resources.
          </p>
        )}
        {id === "air-blower" && (
          <>
            <p>
              The Asset health scorecard shows latest values, valid window
              averages, configured limits and per-metric quality. Missing means
              no valid value; Stale means a held reading with an explicit
              last-fresh timestamp; Fallback identifies a disclosed substitute
              calculation. Missing and stale results do not enter averages or
              the POC health index. Stale bearing and vibration readings do not
              produce fresh condition alarms.
            </p>
            <p>
              The POC health index is a visible, uncalibrated rubric: start at
              100; subtract 14 / 28 / 45 for each scored advisory / alarm /
              trip, plus 4 for a bearing rise over 2 °C in the selected window.
              Compare overlays the current window with a canned clean-filter
              simulation, aligned by elapsed time without interpolation.
              Original timestamps remain available. POC demo datasets are
              deliberate local replacements and can be restored to the published
              data.
            </p>
          </>
        )}
        {id === "furnace-skin-temp" && (
          <p>
            Heater 1, Pass 3 adds one flow-split slider. Run scenario applies an
            explicitly simulated response to the unchanged original baseline;
            moving the slider alone does not apply it. Reset returns to
            baseline. The displayed domain is the observed history range, not a
            validated intervention range. No causal intervention effect is
            validated. The 24 h forecast validation boundary and extrapolated
            region are labelled. Scenario intervals add an illustrative
            allowance to original P10-P90 spread and are not calibrated
            confidence bounds.
          </p>
        )}
      </section>
      {nodes.map(render)}
    </article>
  );
}
