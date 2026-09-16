import { WorkspaceProvider } from "./lib/WorkspaceContext";
import { lazy, Suspense } from "react";
import { PageBoundary } from "./components/PageBoundary";
import { DatabasePage } from "./pages/DatabasePage";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { DashboardsPage } from "./pages/DashboardsPage";
import { PredictorsPage } from "./pages/PredictorsPage";
const AirBlowerPage = lazy(() =>
  import("./pages/AirBlowerPage").then((m) => ({ default: m.AirBlowerPage })),
);
const FiredHeaterPage = lazy(() =>
  import("./pages/FiredHeaterPage").then((m) => ({
    default: m.FiredHeaterPage,
  })),
);
const ShellTubeExchangerPage = lazy(() =>
  import("./pages/ShellTubeExchangerPage").then((m) => ({
    default: m.ShellTubeExchangerPage,
  })),
);
const MembraneAnalyzerPage = lazy(() =>
  import("./pages/MembraneAnalyzerPage").then((m) => ({
    default: m.MembraneAnalyzerPage,
  })),
);
const FurnaceSkinTempPage = lazy(() =>
  import("./pages/FurnaceSkinTempPage").then((m) => ({
    default: m.FurnaceSkinTempPage,
  })),
);
const CrudeToProfitPage = lazy(() =>
  import("./pages/CrudeToProfitPage").then((m) => ({
    default: m.CrudeToProfitPage,
  })),
);
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <WorkspaceProvider>
        <AppShell>
          <PageBoundary>
            <Suspense fallback={<p role="status">Loading page…</p>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="/dashboards" element={<DashboardsPage />} />
                <Route path="/predictors" element={<PredictorsPage />} />
                <Route
                  path="/equipment/air-blower"
                  element={<AirBlowerPage />}
                />
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
                <Route
                  path="/crude-to-profit"
                  element={<CrudeToProfitPage />}
                />
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
            </Suspense>
          </PageBoundary>
        </AppShell>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}

export default App;
