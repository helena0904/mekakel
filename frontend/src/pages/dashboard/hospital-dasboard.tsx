import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function HospitalDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <h1>Hospital / Clinic Dashboard</h1>

        <p>
          Welcome, {user?.name}!
        </p>

        <p>
          Manage your institution's blood coordination activities.
        </p>

        <section className="dashboard-card">
          <h2>Institution Account</h2>

          <p>Email: {user?.email}</p>

          <p>Account Type: Hospital / Clinic</p>

          <p>Role: {user?.role}</p>
        </section>

        <section className="dashboard-card">
          <h2>Hospital Activities</h2>

          <p>Manage blood inventory.</p>

          <p>Create blood requests.</p>

          <p>Track your blood requests.</p>

          <p>Coordinate with other hospitals and clinics.</p>

          <p>Find eligible, verified donors when needed.</p>
        </section>

        <button
          type="button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </main>
  )
}

export default HospitalDashboard