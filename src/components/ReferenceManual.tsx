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
        Reference limits and example values below are documentation. The
        current workspace configuration and observation dates shown on the
        page take precedence. Reference limits are not operating
        instructions.
      </p>
      {(id === "air-blower" || id === "furnace-skin-temp") && (
        <section className="manual-current-edition">
          {id === "air-blower" && (
            <>
              <h3>Asset health scorecard</h3>
              <p>
                The scorecard shows the latest value, the valid-window average,
                the configured limit and a data-quality flag for each metric.
                Missing means no valid value; Stale means a held reading with a
                labelled last-fresh timestamp; Fallback means a disclosed
                substitute calculation. Missing and stale results are excluded
                from window averages and from the health index below. A stale
                bearing or vibration reading does not raise a fresh alarm.
              </p>
              <p>
                The health index is an uncalibrated summary score: start at
                100, subtract 14 for each scored advisory, 28 for each alarm,
                45 for each trip, plus 4 if bearing temperature has risen more
                than 2 °C in the selected window. Compare overlays the current
                window against a stored clean-filter baseline run, aligned by
                elapsed time rather than by matching timestamps.
              </p>
            </>
          )}
          {id === "furnace-skin-temp" && (
            <p>
              Heater 1, Pass 3 has one flow-split slider. Run scenario applies
              a simulated response on top of the baseline forecast; moving the
              slider alone does not change the forecast. Reset returns to
              baseline. The slider range is the observed operating history, not
              a range validated for real intervention, and no causal effect of
              changing the flow split has been validated against plant data.
              The scenario's wider interval is an illustrative allowance added
              to the model's P10-P90 band, not a separately calibrated
              confidence bound.
            </p>
          )}
        </section>
      )}
      {nodes.map(render)}
    </article>
  );
}
