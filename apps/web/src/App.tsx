import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GalaxyPage }        from './pages/Galaxy/GalaxyPage'
import { Layout }            from './components/Layout/Layout'
import { AuthGuard }         from './components/AuthGuard/AuthGuard'
import { LoginPage }         from './pages/Login/LoginPage'
import { PhonesPage }        from './pages/Phones/PhonesPage'
import { PhoneDetailPage }   from './pages/PhoneDetail/PhoneDetailPage'
import { AccountsPage }      from './pages/Accounts/AccountsPage'
import { AccountDetailPage } from './pages/AccountDetail/AccountDetailPage'
import { GeneratePage }      from './pages/Generate/GeneratePage'
import { QueuePage }         from './pages/Queue/QueuePage'
import { VideosPage }        from './pages/Videos/VideosPage'
import { ClientsPage }       from './pages/Clients/ClientsPage'

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
            <Route path="/phones"            element={<PhonesPage />} />
            <Route path="/phones/:id"        element={<PhoneDetailPage />} />
            <Route path="/accounts"          element={<AccountsPage />} />
            <Route path="/accounts/:id"      element={<AccountDetailPage />} />
            <Route path="/generate"          element={<GeneratePage />} />
            <Route path="/queue"             element={<QueuePage />} />
            <Route path="/videos"            element={<VideosPage />} />
            <Route path="/clients"           element={<ClientsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
