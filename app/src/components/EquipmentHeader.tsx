import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { EquipmentState } from "../engineering/types";
import { StatusBadge } from "./StatusBadge";

export interface EquipmentHeaderProps {
  name: string;
  meta: string;
  freshness: string;
  state: EquipmentState;
  rangeControl?: ReactNode;
}

export function EquipmentHeader({ name, meta, freshness, state, rangeControl }: EquipmentHeaderProps) {
  return (
    <>
      <div className="crumb"><Link to="/">Home</Link> / {name}</div>
      <div className="top-row">
        <div className="top-left">
          <div className="asset-title-row">
            <span className="asset-name">{name}</span>
            <StatusBadge state={state} />
          </div>
          <div className="asset-meta">{meta}</div>
          <div className="asset-fresh">{freshness}</div>
        </div>
        {rangeControl}
      </div>
    </>
  );
}
