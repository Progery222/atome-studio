import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard/AuthGuard";
import { RoleGuard } from "./components/AuthGuard/RoleGuard";
import { Layout } from "./components/Layout/Layout";
import { AccountDetailPage } from "./pages/AccountDetail/AccountDetailPage";
import { AccountsPage } from "./pages/Accounts/AccountsPage";
import { AnalyticsPage } from "./pages/Analytics/AnalyticsPage";
import { ClientsPage } from "./pages/Clients/ClientsPage";
import { GalaxyPage } from "./pages/Galaxy/GalaxyPage";
import { GeneratePage } from "./pages/Generate/GeneratePage";
import { LoginPage } from "./pages/Login/LoginPage";
import { PhoneDetailPage } from "./pages/PhoneDetail/PhoneDetailPage";
import { PhonesPage } from "./pages/Phones/PhonesPage";
import { QueuePage } from "./pages/Queue/QueuePage";
import { SettingsPage } from "./pages/Settings/SettingsPage";
import { VideosPage } from "./pages/Videos/VideosPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Galaxy — public entry point */}
        <Route path="/" element={<GalaxyPage />} />

        {/* Protected + Layout */}
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/phones" element={<PhonesPage />} />
            <Route path="/phones/:id" element={<PhoneDetailPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/generate" element={<GeneratePage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />

            <Route path="/settings" element={<SettingsPage />} />

            {/* Super admin only (FR-15.7) */}
            <Route element={<RoleGuard roles={["super_admin"]} />}>
              <Route path="/clients" element={<ClientsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
