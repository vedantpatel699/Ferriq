import { engineeringManuals } from "../reference/engineeringManuals";
import { DataTable } from "./DataTable";
import { FormulaBlock, ManualSection } from "./ModelPagePrimitives";

export function ReferenceManual({ id }: { id: string }) {
  const manual = engineeringManuals[id];
  if (!manual) return null;
  return (
    <article className="reference-manual engineering-manual">
      <h2>{manual.title} engineering manual</h2>
      <p className="manual-lead">{manual.purpose}</p>
      <ManualSection title="Run the Python model">
        <p>
          Open{" "}
          {id === "furnace-skin-temp"
            ? "furnace_skin_ti_predictor"
            : id.replaceAll("-", "_")}
          _engine.py in Python IDLE. Select Run, then Run Module (F5). Python
          3.10 or newer is required; no extra packages or other files are
          needed.
        </p>
        <p>
          The built-in example writes a results JSON file beside the Python
          file. Edit SETTINGS near the top and run again to change assumptions.
          To use your own measurements, run the file with an input JSON
          filename. Inputs use the fields and units below.
        </p>
        <p>
          The input envelope contains schemaVersion, model, source, timezone,
          config and measurements. Each measurement contains timestamp, values
          and optional quality. Use ISO timestamps with an offset. Bad, stale
          and missing signals remain unavailable. The AVEVA mapping is
          provisional; a live connection has not been verified.
        </p>
      </ManualSection>
      <ManualSection title="Inputs and units">
        <DataTable
          caption="Model inputs"
          columns={["input", "unit", "use"]}
          rows={manual.inputs.map(([input, unit, use]) => ({
            input,
            unit,
            use,
          }))}
        />
      </ManualSection>
      <ManualSection title="Calculations">
        {manual.calculations.map(([name, formula, note]) => (
          <FormulaBlock key={name} name={name} note={note}>
            {formula}
          </FormulaBlock>
        ))}
      </ManualSection>
      <ManualSection title="Useful trends">
        <ul>
          {manual.trends.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </ManualSection>
      <ManualSection title="Assumptions and limits">
        <ul>
          {manual.limits.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <p>
          Measured values come from instruments or samples. Calculated values
          use those inputs and the configured assumptions. Design values are
          references. Simulated values demonstrate the model and are not plant
          measurements. Missing results remain unavailable.
        </p>
      </ManualSection>
      <ManualSection title="Sources">
        <ul>
          {manual.sources.map(([label, url]) => (
            <li key={label}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ) : (
                label
              )}
            </li>
          ))}
        </ul>
      </ManualSection>
    </article>
  );
}
