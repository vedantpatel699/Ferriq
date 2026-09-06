import { NavLink } from "react-router-dom";
import { EQUIPMENT_REGISTRY, stateLabel } from "../lib/equipmentRegistry";

/** One consistent application-wide navigation — replaces the ~150-line
 *  sidebar block duplicated verbatim across all 18 pages of the original
 *  HTML site. Frequently used equipment stays directly reachable on
 *  desktop (no mega-menu / no burying equipment behind a dropdown); on
 *  tablet it collapses to an icon rail (see theme.css @media 900px). */
export function Sidebar() {
  const watchCount = EQUIPMENT_REGISTRY.filter((e) => e.state !== "normal").length;

  return (
    <nav className="sidebar">
      <NavLink className="brand" to="/">
        <span className="brand-mark">Fe</span>
        <span className="brand-name">Ferriq</span>
      </NavLink>

      <NavLink className={({ isActive }) => `navlink${isActive ? " current" : ""}`} to="/" end title="Home">
        <span className="navtext">Home</span>
      </NavLink>

      <div className="nav-label">Equipment</div>
      {EQUIPMENT_REGISTRY.map((eq) => (
        <NavLink
          key={eq.id}
          className={({ isActive }) => `navlink${isActive ? " current" : ""}`}
          to={eq.path}
          title={eq.name}
        >
          <span className="navtext">{eq.name}</span>
          {eq.state !== "normal" && <span className="watch-tag">{stateLabel(eq.state)}</span>}
        </NavLink>
      ))}

      <div className="nav-label">Monitor</div>
      <NavLink className={({ isActive }) => `navlink${isActive ? " current" : ""}`} to="/watchlist" title="Watchlist">
        <span className="navtext">Watchlist</span>
        <span className="count-badge">{watchCount}</span>
      </NavLink>

      <div className="sidebar-spacer" />
      <div className="sidebar-divider" />
      <NavLink className={({ isActive }) => `navlink${isActive ? " current" : ""}`} to="/settings" title="Settings">
        <span className="navtext">Settings</span>
      </NavLink>
      <div className="sidebar-divider" />
      <div className="sidebar-user">
        <div className="avatar">VP</div>
        <div className="user-meta">
          <div className="user-name">Vedant Patel</div>
          <div className="user-role">Engineer</div>
        </div>
      </div>
    </nav>
  );
}
