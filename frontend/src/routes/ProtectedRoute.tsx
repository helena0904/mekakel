import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
  allowedAccountType: 'INDIVIDUAL' | 'HOSPITAL'
}

function ProtectedRoute({
  allowedAccountType,
}: ProtectedRouteProps) {
  const { user, token } = useAuth()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.accountType !== allowedAccountType) {
    const correctDashboard =
      user.accountType === 'INDIVIDUAL'
        ? '/donor-dashboard'
        : '/hospital-dashboard'

    return <Navigate to={correctDashboard} replace />
  }

  return <Outlet />
}

export default ProtectedRoute