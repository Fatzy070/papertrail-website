import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../hooks/use-auth'
import { LoadingState } from '../components/ui/LoadingState'

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LoadingState />
    </div>
  )
}

export function ProtectedRoute() {
  const user = useCurrentUser()
  const location = useLocation()
  if (user.isPending) return <LoadingScreen />
  if (!user.data)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const user = useCurrentUser()
  if (user.isPending) return <LoadingScreen />
  if (user.data) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
