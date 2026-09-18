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
