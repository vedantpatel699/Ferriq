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
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/dashboards" element={<DashboardsPage />} />
          <Route path="/predictors" element={<PredictorsPage />} />
          <Route path="/equipment/air-blower" element={<AirBlowerPage />} />
          <Route path="/equipment/fired-heater" element={<FiredHeaterPage />} />
          <Route path="/equipment/shell-tube-exchanger" element={<ShellTubeExchangerPage />} />
          <Route path="/equipment/membrane-analyzer" element={<MembraneAnalyzerPage />} />
          <Route path="/predictors/furnace-skin-temp" element={<FurnaceSkinTempPage />} />
          <Route path="/crude-to-profit" element={<CrudeToProfitPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
