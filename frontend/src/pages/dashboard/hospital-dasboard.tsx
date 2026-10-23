import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import {
  getHospitalDashboard,
  HOSPITAL_STATUS_LABELS,
  hospitalStatusBadgeClass,
} from '../../services/hospital.service'
import type {
  HospitalProfile,
  HospitalStaffRoleValue,
} from '../../services/hospital.service'

function HospitalDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] =
    useState<HospitalProfile | null>(null)
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getHospitalDashboard()

        if (!cancelled) {
          setProfile(loaded.hospital)
          setRole(loaded.role)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your hospital dashboard'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
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

        {loading && <p role="status">Loading your dashboard…</p>}

        {profile && (
          <>
            <section className="dashboard-card">
              <h2>Institution account</h2>

              <p>Email: {user?.email}</p>

              <p>
                Institution: {profile.hospitalName}
              </p>

              <p>Your role: {role}</p>

              <p>
                Registration status:{' '}
                <span
                  className={hospitalStatusBadgeClass(
                    profile.status
                  )}
                >
                  {HOSPITAL_STATUS_LABELS[profile.status]}
                </span>
              </p>
            </section>

            {profile.status !== 'APPROVED' && (
              <section className="verification-status">
                <div className="verification-status-header">
                  <h2>Approval required</h2>
                </div>

                <p>
                  Inventory and staff management unlock once
                  an administrator approves your institution.
                </p>

                {profile.reviewNotes && (
                  <p className="verification-notes">
                    Reviewer note: {profile.reviewNotes}
                  </p>
                )}
              </section>
            )}

            <section className="dashboard-card">
              <h2>Hospital activities</h2>

              <ul className="donor-links">
                <li>
                  <Link to="/hospital/profile">
                    Hospital profile and contact details
                  </Link>
                </li>
                <li>
                  <Link to="/hospital/inventory">
                    Blood inventory management
                  </Link>
                </li>
                <li>
                  <Link to="/hospital/search">
                    Search nearby donors and hospitals
                  </Link>
                </li>
                <li>
                  <Link to="/hospital/transfers">
                    Hospital-to-hospital transfers
                  </Link>
                </li>
              </ul>
            </section>
          </>
        )}

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </main>
  )
}

export default HospitalDashboard
