import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPathFor } from '../utils/dashboard'

interface ProtectedRouteProps {
  allowedAccountType: 'INDIVIDUAL' | 'HOSPITAL'
}

function ProtectedRoute({
  allowedAccountType,
}: ProtectedRouteProps) {
  const { user, token, isLoading } = useAuth()

  // Wait for the server session check before deciding where to redirect,
  // otherwise a valid user would be bounced to /login on first paint.
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600"
      >
        Loading your session…
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.accountType !== allowedAccountType) {
    return (
      <Navigate
        to={dashboardPathFor(user.accountType)}
        replace
      />
    )
  }

  return <Outlet />
}

export default ProtectedRoute