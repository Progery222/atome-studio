import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard/AuthGuard";
import { RoleGuard } from "./components/AuthGuard/RoleGuard";
import { CommandPalette } from "./components/CommandPalette";
import { Layout } from "./components/Layout/Layout";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { AccountDetailPage } from "./pages/AccountDetail/AccountDetailPage";
import { AccountsPage } from "./pages/Accounts/AccountsPage";
import { AnalyticsPage } from "./pages/Analytics/AnalyticsPage";
import { AccountStatsPage } from "./pages/AccountStats/AccountStatsPage";
import { AuditPage } from "./pages/Audit";
import { ClientsPage } from "./pages/Clients/ClientsPage";
import { GalaxyPage } from "./pages/Galaxy/GalaxyPage";
import { GeneratePage } from "./pages/Generate/GeneratePage";
import { HomePage } from "./pages/Home/HomePage";
import { LoginPage } from "./pages/Login/LoginPage";
import { PhoneDetailPage } from "./pages/PhoneDetail/PhoneDetailPage";
import { SettingsPage } from "./pages/Settings/SettingsPage";
import { VideosPage } from "./pages/Videos/VideosPage";

function GlobalShell({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <GlobalShell>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Galaxy — public entry point (как раньше) */}
          <Route path="/" element={<GalaxyPage />} />

          {/* Protected + Layout */}
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/phones" element={<Navigate to="/dashboard" replace />} />
              <Route path="/phone-grid" element={<Navigate to="/dashboard" replace />} />
              <Route path="/queue" element={<Navigate to="/dashboard" replace />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/account-groups" element={<Navigate to="/dashboard" replace />} />
              <Route path="/accounts/:id" element={<AccountDetailPage />} />
              <Route path="/phones/:id" element={<PhoneDetailPage />} />
              <Route path="/generate" element={<GeneratePage />} />
              <Route path="/content" element={<VideosPage />} />
              <Route path="/videos" element={<VideosPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/account-stats" element={<AccountStatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Super admin only (FR-15.7) */}
              <Route element={<RoleGuard roles={["super_admin"]} />}>
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/audit" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </GlobalShell>
    </BrowserRouter>
  );
}
