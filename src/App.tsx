import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Layout } from './components/Layout'
import { Analysis, AnalysisDetail } from './pages/Analysis'
import { Catalog } from './pages/Catalog'
import { ClientDetail } from './pages/ClientDetail'
import { Clients } from './pages/Clients'
import { Dashboard } from './pages/Dashboard'
import { LifePlanDetail, LifePlans } from './pages/LifePlan'
import { LifeReport } from './pages/LifeReport'
import { Report } from './pages/Report'

export function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <Routes>
        <Route path="clients/:id/report" element={<Report />} />
        <Route path="finance/:id/report" element={<LifeReport />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="analysis/:id" element={<AnalysisDetail />} />
          <Route path="finance" element={<LifePlans />} />
          <Route path="finance/:id" element={<LifePlanDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
