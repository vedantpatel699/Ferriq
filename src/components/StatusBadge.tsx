import type { EquipmentState } from "../engineering/types";
import { stateLabel } from "../lib/equipmentRegistry";

/** Renders Ferriq's page-level engineering state — never a raw physical
 *  severity tier (advisory/alarm/trip); see types.ts EquipmentState doc. */
export function StatusBadge({
  state,
  className,
}: {
  state: EquipmentState;
  className?: string;
}) {
  return (
    <span className={`state-pill ${state}${className ? ` ${className}` : ""}`}>
      {stateLabel(state)}
    </span>
  );
}
