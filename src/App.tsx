import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { Catalog } from './pages/Catalog'
import { ClientDetail } from './pages/ClientDetail'
import { Clients } from './pages/Clients'
import { Dashboard } from './pages/Dashboard'
import { Report } from './pages/Report'

export function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <Routes>
        <Route path="clients/:id/report" element={<Report />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
