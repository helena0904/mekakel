import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

function DonorDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <h1>Individual Donor Dashboard</h1>

        <p>
          Welcome, {user?.name}!
        </p>

        <p>
          Thank you for being part of MEKAKEL.
        </p>

        <section className="dashboard-card">
          <h2>Your Account</h2>

          <p>Email: {user?.email}</p>

          <p>Account Type: Individual Donor</p>

          <p>Role: {user?.role}</p>
        </section>

        <section className="dashboard-card">
          <h2>Donor Activities</h2>

          <p>Manage your donor profile.</p>

          <p>Check your medical verification status.</p>

          <p>Manage your donation availability.</p>

          <p>View blood donation requests.</p>
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

export default DonorDashboard