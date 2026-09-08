import { Link } from "react-router-dom";
import { identities, equipmentIds } from "../engineering/catalog";
export function HelpPage() {
  return (
    <>
      <h1>Help & engineering manuals</h1>
      <p>
        Open an equipment page and select Engineering manual for the original
        HTML calculation descriptions, sources and current configured reference
        limits. Calculation basis opens the same reference material beside the
        chart.
      </p>
      <ul>
        {equipmentIds.map((id) => (
          <li key={id}>
            <Link to={"/equipment/" + id}>{identities[id].name}</Link>
          </li>
        ))}
        <li>
          <Link to="/predictors/furnace-skin-temp">
            Furnace Skin TI Predictor
          </Link>
        </li>
        <li>
          <Link to="/crude-to-profit">Crude to Profit</Link>
        </li>
      </ul>
      <h2>Data and status</h2>
      <p>
        NORMAL, WATCH and INVESTIGATE describe engineering review conditions.
        DATA ISSUE identifies missing or invalid inputs. Reference limits are
        not control-system alarms or operating instructions. Dates and shift
        boundaries use America/Edmonton.
      </p>
      <p>
        This static edition uses published reference data and browser-local
        edits. Original manuals may describe historian or market integrations;
        those integrations are not active here. CSV imports, price snapshots and
        workspace backups are explicit user actions.
      </p>
      <Link to="/data-export">Back up or restore your workspace</Link>
    </>
  );
}
