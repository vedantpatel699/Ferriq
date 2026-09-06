import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { EQUIPMENT_REGISTRY } from "../lib/equipmentRegistry";

export function PredictorsPage() {
  const predictors = EQUIPMENT_REGISTRY.filter((e) => e.id === "furnace-skin-temp");
  return (
    <>
      <div className="top-row">
        <div className="top-left">
          <div className="kicker">Monitor</div>
          <div className="page-title">Predictors</div>
          <div className="page-sub">Model-based forecasts for equipment nearing an engineering constraint</div>
        </div>
      </div>
      <div className="equipment-grid">
        {predictors.map((eq) => (
          <Link className="eq-card" to={eq.path} key={eq.id}>
            <div className="eq-top">
              <div className="eq-id">
                <span className="eq-name">{eq.name}</span>
                <span className="eq-tag">{eq.tag}</span>
              </div>
              <StatusBadge state={eq.state} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
