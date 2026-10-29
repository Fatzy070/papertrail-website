import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { LoadingState } from './components/ui/LoadingState'
import { ToastViewport } from './components/ui/ToastViewport'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/RouteGuards'
import { SettingsPage } from './pages/SettingsPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { AuthShell } from './components/auth/AuthShell'
import { SupportPage } from './pages/SupportPage'
import { MainLayout } from './layouts/MainLayout'
import { DocumentsPage } from './pages/DocumentsPage'
import { BillingCallbackPage } from './pages/BillingCallbackPage'
import { LandingPage } from './pages/LandingPage'
import { ToolsPage } from './pages/tools/ToolsPage'

const WriterPage = lazy(() => import('./writer/WriterPage'))
const EditorPage = lazy(() =>
  import('./pages/EditorPage').then((m) => ({ default: m.EditorPage })),
)
const MergePdfPage = lazy(() =>
  import('./pages/tools/MergePdfPage').then((m) => ({ default: m.MergePdfPage })),
)
const SplitPdfPage = lazy(() =>
  import('./pages/tools/SplitPdfPage').then((m) => ({ default: m.SplitPdfPage })),
)
const CompressPdfPage = lazy(() =>
  import('./pages/tools/CompressPdfPage').then((m) => ({
    default: m.CompressPdfPage,
  })),
)
const ConvertPdfPage = lazy(() =>
  import('./pages/tools/ConvertPdfPage').then((m) => ({
    default: m.ConvertPdfPage,
  })),
)

class ChunkErrorBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="workspace-content" role="alert">
          <div className="error-message">
            <p>Unable to load this page. A newer version of Papertrail may be available.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function LazyRoute({
  label,
  fullScreen = false,
  children,
}: {
  label: string
  fullScreen?: boolean
  children: ReactNode
}) {
  const location = useLocation()
  return (
    <ChunkErrorBoundary resetKey={location.pathname}>
      <Suspense
        fallback={
          fullScreen ? (
            <div className="grid min-h-screen place-items-center">
              <LoadingState label={label} />
            </div>
          ) : (
            <div className="workspace-content">
              <LoadingState label={label} />
            </div>
          )
        }
      >
        {children}
      </Suspense>
    </ChunkErrorBoundary>
  )
}

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
            <Route
              path="/tools/merge"
              element={
                <LazyRoute label="Opening Merge PDF…">
                  <MergePdfPage />
                </LazyRoute>
              }
            />
            <Route path="/tools" element={<ToolsPage />} />
            <Route
              path="/tools/split"
              element={
                <LazyRoute label="Opening Split & Extract…">
                  <SplitPdfPage />
                </LazyRoute>
              }
            />
            <Route
              path="/tools/compress"
              element={
                <LazyRoute label="Opening Compress PDF…">
                  <CompressPdfPage />
                </LazyRoute>
              }
            />
            <Route
              path="/tools/convert"
              element={
                <LazyRoute label="Opening Convert PDF…">
                  <ConvertPdfPage />
                </LazyRoute>
              }
            />
          </Route>
          <Route
            path="/writer/:documentId"
            element={
              <LazyRoute label="Opening Writer…" fullScreen>
                <WriterPage />
              </LazyRoute>
            }
          />
          <Route
            path="/documents/:documentId/edit"
            element={
              <LazyRoute label="Opening editor…" fullScreen>
                <EditorPage />
              </LazyRoute>
            }
          />
          <Route path="/billing/callback" element={<BillingCallbackPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastViewport />
    </BrowserRouter>
  )
}

export default App

