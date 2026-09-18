import { Link } from "react-router-dom";
import { EQUIPMENT_REGISTRY } from "../lib/equipmentRegistry";
export function HomePage() {
  return (
    <>
      <h1>Engineering overview</h1>
      <div className="summary-grid" aria-label="Models">
        {EQUIPMENT_REGISTRY.map((model) => (
          <Link
            className="card card-body model-tile"
            key={model.id}
            to={model.path}
          >
            {model.name}
          </Link>
        ))}
      </div>
    </>
  );
}
