import { Link } from "react-router-dom";
import { identities, equipmentIds } from "../engineering/catalog";
export function HelpPage() {
  return (
    <>
      <h1>Help & engineering manuals</h1>
      <p>
        If browser storage is unavailable, reference data remain readable and saving is disabled.
        Restore site-storage access and use Retry browser storage. Existing saved data are not deleted.
        A predictor-model download failure has its own retry and does not block other dashboards.
      </p>
      <p>
        Open an equipment page and select Engineering manual for calculation
        descriptions, sources and the currently configured reference limits.
        Calculation basis opens the same reference material beside the chart.
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
        Dashboards run on bundled reference data plus any CSV you upload; there
        is no live historian connection. Crude to Profit is the exception: its
        crude and product prices refresh daily from the public sources listed
        on its Price snapshot tab. CSV imports, price refreshes and workspace
        backups only happen when you trigger them.
      </p>
      <Link to="/data-export">Back up or restore your workspace</Link>
    </>
  );
}
