import type { DataQualityState } from "../engineering/types";

const KIND_LABEL: Record<DataQualityState["kind"], string> = {
  "data-quality": "Data quality.",
  "calculation-assumption": "Calculation assumption.",
  "model-limitation": "Model limitation.",
};
const KIND_CLASS: Record<DataQualityState["kind"], string> = {
  "data-quality": "",
  "calculation-assumption": "assumption",
  "model-limitation": "limitation",
};

/** Renders one data-quality/assumption/limitation callout. These three
 *  kinds are kept textually distinct per the terminology split: a stale
 *  sensor is not the same claim as a fixed Cp assumption, which is not the
 *  same claim as an under-calibrated model. Never merge them into one
 *  generic "data issue" note. */
export function DataQualityNotice({ items }: { items: DataQualityState[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item, i) => (
        <div
          className={`callout${KIND_CLASS[item.kind] ? ` ${KIND_CLASS[item.kind]}` : ""}`}
          key={i}
        >
          <strong>{KIND_LABEL[item.kind]}</strong> {item.message}
        </div>
      ))}
    </>
  );
}
