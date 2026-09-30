import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { ToastViewport } from './components/ui/ToastViewport'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/RouteGuards'
import { SettingsPage } from './pages/SettingsPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { AuthShell } from './components/auth/AuthShell'
import { SupportPage } from './pages/SupportPage'

import { MainLayout } from './layouts/MainLayout'
import { DocumentsPage } from './pages/DocumentsPage'
import { MergePdfPage } from './pages/tools/MergePdfPage'
import { SplitPdfPage } from './pages/tools/SplitPdfPage'
import { CompressPdfPage } from './pages/tools/CompressPdfPage'
import { ConvertPdfPage } from './pages/tools/ConvertPdfPage'
import { BillingCallbackPage } from './pages/BillingCallbackPage'
import { LandingPage } from './pages/LandingPage'
import { ToolsPage } from './pages/tools/ToolsPage'


function RedirectWithParams({ to, step }: { to: string; step: string }) {
  const [searchParams] = useSearchParams()
  searchParams.set('step', step)
  return <Navigate to={`${to}?${searchParams.toString()}`} replace />
}


function App() {
  return (
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/auth" element={<AuthShell />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<RedirectWithParams to="/auth" step="forgot-password" />} />
            <Route path="/reset-password" element={<RedirectWithParams to="/auth" step="reset-password" />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/documents" element={<DocumentsPage filter="all" />} />
              <Route path="/recent" element={<DocumentsPage filter="recent" />} />
              <Route path="/starred" element={<DocumentsPage filter="starred" />} />
              <Route path="/trash" element={<DocumentsPage filter="trash" />} />
              <Route path="/tools/merge" element={<MergePdfPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/tools/split" element={<SplitPdfPage />} />
              <Route path="/tools/compress" element={<CompressPdfPage />} />
              <Route path="/tools/convert" element={<ConvertPdfPage />} />
            </Route>
            <Route path="/documents/:documentId/edit" element={<EditorPage />} />
            <Route path="/billing/callback" element={<BillingCallbackPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastViewport />
      </BrowserRouter>
  )
}

export default App
