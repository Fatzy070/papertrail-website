import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { ToastViewport } from './components/ui/ToastViewport'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/RouteGuards'
import { ThemeProvider } from './hooks/use-theme'
import { SettingsPage } from './pages/SettingsPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { AuthShell } from './components/auth/AuthShell'
import { SupportPage } from './pages/SupportPage'
import { WorkspacePlaceholderPage } from './pages/WorkspacePlaceholderPage'
import { MainLayout } from './layouts/MainLayout'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

function RedirectWithParams({ to, step }: { to: string; step: string }) {
  const [searchParams] = useSearchParams()
  searchParams.set('step', step)
  return <Navigate to={`${to}?${searchParams.toString()}`} replace />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <BrowserRouter>
        <Routes>
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
              <Route path="/recent" element={<WorkspacePlaceholderPage />} />
              <Route path="/starred" element={<WorkspacePlaceholderPage />} />
              <Route path="/trash" element={<WorkspacePlaceholderPage />} />
              <Route path="/tools/merge" element={<WorkspacePlaceholderPage />} />
              <Route path="/tools/split" element={<WorkspacePlaceholderPage />} />
              <Route path="/tools/compress" element={<WorkspacePlaceholderPage />} />
              <Route path="/tools/convert" element={<WorkspacePlaceholderPage />} />
            </Route>
            <Route path="/documents/:documentId/edit" element={<EditorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastViewport />
      </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
