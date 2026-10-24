import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { listVerificationQueue } from '../../services/doctor.service'

function DoctorDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const donors = await listVerificationQueue({
          status: 'PENDING',
        })

        if (!cancelled) {
          setPending(donors.length)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the verification queue'
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
  <h1>Welcome, {user?.name}!</h1>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        <section className="dashboard-card">
          <h2>Medical verification</h2>

          <p>
            {pending === null
              ? 'Loading pending reviews…'
              : pending === 0
                ? 'No donor reports are awaiting review.'
                : `${pending} donor ${
                    pending === 1 ? 'report' : 'reports'
                  } awaiting review.`}
          </p>

          <ul className="donor-links">
            <li>
              <Link to="/doctor/verifications">
                Open the verification queue
              </Link>
            </li>
          </ul>
        </section>

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </main>
  )
}

export default DoctorDashboard
