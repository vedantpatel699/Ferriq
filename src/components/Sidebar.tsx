import { NavLink } from "react-router-dom";
import { EQUIPMENT_REGISTRY } from "../lib/equipmentRegistry";
export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const link = (to: string, label: string) => (
    <NavLink
      key={to}
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }) => "navlink" + (isActive ? " current" : "")}
      to={to}
    >
      <span className="navtext">{label}</span>
    </NavLink>
  );
  return (
    <nav className="sidebar" id="main-navigation" aria-label="Main navigation">
      <NavLink className="brand" to="/" onClick={onNavigate}>
        <span className="brand-mark">Fe</span>
        <span className="brand-name">Ferriq</span>
      </NavLink>
      {link("/", "Overview")}
      <div className="nav-label">Equipment</div>
      {EQUIPMENT_REGISTRY.map((e) => link(e.path, e.name))}
      <div className="sidebar-spacer" />
      <p className="source-note">
        Published reference data
        <br />
        Edits saved in this browser
      </p>
    </nav>
  );
}
