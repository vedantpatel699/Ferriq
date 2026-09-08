import { NavLink } from "react-router-dom";
import { useSummaries } from "../lib/summaries";
import { stateLabel } from "../lib/equipmentRegistry";
export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const items = useSummaries();
  const link = (to: string, label: string, badge?: string) => (
    <NavLink
      key={to}
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }) => "navlink" + (isActive ? " current" : "")}
      to={to}
    >
      <span className="navtext">{label}</span>
      {badge && <span className="watch-tag">{badge}</span>}
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
      {items.map((e) =>
        link(
          e.path,
          e.name,
          e.state === "normal" ? undefined : stateLabel(e.state),
        ),
      )}
      {link("/crude-to-profit", "Crude to Profit")}
      <div className="nav-label">Workspace</div>
      {link(
        "/watchlist",
        "Watchlist",
        String(items.filter((e) => e.priority > 0).length),
      )}
      {link("/data-export", "Database & change log")}
      {link("/settings", "Settings")}
      {link("/help", "Help & manuals")}
      <div className="sidebar-spacer" />
      <p className="source-note">
        Published reference data
        <br />
        Edits saved in this browser
      </p>
    </nav>
  );
}
