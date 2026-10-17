import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPathForUser } from '../utils/dashboard'

interface ProtectedRouteProps {
  allowedAccountType?: 'INDIVIDUAL' | 'HOSPITAL'
  allowedRoles?: string[]
}

function ProtectedRoute({
  allowedAccountType,
  allowedRoles,
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

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <Navigate to={dashboardPathForUser(user)} replace />
    )
  }

  if (
    allowedAccountType &&
    user.accountType !== allowedAccountType
  ) {
    return (
      <Navigate to={dashboardPathForUser(user)} replace />
    )
  }

  return <Outlet />
}

export default ProtectedRoute
