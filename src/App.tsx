import { WorkspaceProvider } from "./lib/WorkspaceContext";
import { DatabasePage } from "./pages/DatabasePage";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { DashboardsPage } from "./pages/DashboardsPage";
import { PredictorsPage } from "./pages/PredictorsPage";
import { AirBlowerPage } from "./pages/AirBlowerPage";
import { FiredHeaterPage } from "./pages/FiredHeaterPage";
import { ShellTubeExchangerPage } from "./pages/ShellTubeExchangerPage";
import { MembraneAnalyzerPage } from "./pages/MembraneAnalyzerPage";
import { FurnaceSkinTempPage } from "./pages/FurnaceSkinTempPage";
import { CrudeToProfitPage } from "./pages/CrudeToProfitPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <WorkspaceProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/dashboards" element={<DashboardsPage />} />
            <Route path="/predictors" element={<PredictorsPage />} />
            <Route path="/equipment/air-blower" element={<AirBlowerPage />} />
            <Route
              path="/equipment/fired-heater"
              element={<FiredHeaterPage />}
            />
            <Route
              path="/equipment/shell-tube-exchanger"
              element={<ShellTubeExchangerPage />}
            />
            <Route
              path="/equipment/membrane-analyzer"
              element={<MembraneAnalyzerPage />}
            />
            <Route
              path="/predictors/furnace-skin-temp"
              element={<FurnaceSkinTempPage />}
            />
            <Route path="/crude-to-profit" element={<CrudeToProfitPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/data-export" element={<DatabasePage />} />
            <Route path="/activity-log" element={<DatabasePage />} />
            <Route
              path="*"
              element={
                <>
                  <h1>Page not found</h1>
                  <Link to="/">Return to overview</Link>
                </>
              }
            />
            <Route path="/help" element={<HelpPage />} />
          </Routes>
        </AppShell>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}

export default App;
