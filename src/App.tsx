import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { ToastViewport } from './components/ui/ToastViewport'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/RouteGuards'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

function RedirectWithParams({ to, step }: { to: string; step: string }) {
  const [searchParams] = useSearchParams()
  searchParams.set('step', step)
  return <Navigate to={`${to}?${searchParams.toString()}`} replace />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<RedirectWithParams to="/auth" step="login" />} />
            <Route path="/register" element={<RedirectWithParams to="/auth" step="register" />} />
            <Route path="/verify-email" element={<RedirectWithParams to="/auth" step="verify-email" />} />
            <Route path="/forgot-password" element={<RedirectWithParams to="/auth" step="forgot-password" />} />
            <Route path="/reset-password" element={<RedirectWithParams to="/auth" step="reset-password" />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents/:documentId/edit" element={<EditorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
