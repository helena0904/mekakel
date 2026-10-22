import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import VerificationStatus from '../../components/donor/verification-status'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
  getDashboard,
} from '../../services/donor.service'
import type { DonorDashboardData } from '../../services/donor.service'

function DonorDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<DonorDashboardData | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getDashboard()

        if (!cancelled) {
          setData(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your dashboard'
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
        <h1>Individual Donor Dashboard</h1>

        <p>Welcome, {user?.name}!</p>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {loading && <p role="status">Loading your dashboard…</p>}

        {data && (
          <>
            <section className="dashboard-card">
              <h2>Account</h2>

              <p>Email: {user?.email}</p>

              <p>
                Blood type:{' '}
                {data.profile.bloodType
                  ? BLOOD_TYPE_LABELS[data.profile.bloodType]
                  : 'Not set'}
              </p>

              <p>
                Availability:{' '}
                <span
                  className={
                    data.profile.currentAvailability ===
                    'AVAILABLE'
                      ? 'status-badge status-badge-approved'
                      : 'status-badge status-badge-pending'
                  }
                >
                  {data.profile.currentAvailability ===
                  'AVAILABLE'
                    ? 'Available'
                    : 'Unavailable'}
                </span>
              </p>

              <p>
                Last donation:{' '}
                {formatDate(data.profile.lastDonation)}
              </p>

              <p>
                Next eligible date:{' '}
                {data.eligibility.nextEligibleDate ?? '—'}
              </p>
            </section>

            <section className="dashboard-card">
              <h2>Donation status</h2>

              <p>
                <span
                  className={
                    data.profile.activeStatus === 'ACTIVE'
                      ? 'status-badge status-badge-approved'
                      : 'status-badge status-badge-rejected'
                  }
                >
                  {data.profile.activeStatus === 'ACTIVE'
                    ? 'Active donor - you are able to donate'
                    : 'Not active - you cannot donate yet'}
                </span>
              </p>

              {data.activation &&
                !data.activation.active &&
                data.activation.reasons.length > 0 && (
                  <ul className="eligibility-list">
                    {data.activation.reasons.map((reason) => (
                      <li key={reason}>
                        <span className="check-fail">✕</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}

              {(data.profile.subcity || data.profile.wereda) && (
                <p>
                  Location:{' '}
                  {[data.profile.wereda, data.profile.subcity]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </section>

            <VerificationStatus
              status={data.profile.verificationStatus}
              notes={data.profile.verificationNotes}
              verifiedAt={data.profile.verifiedAt}
            />

            <section className="dashboard-card">
              <h2>Preliminary eligibility</h2>

              <p>
                {data.eligibility.status === 'ELIGIBLE'
                  ? 'You currently meet the preliminary criteria. A clinician confirms final eligibility.'
                  : data.eligibility.status ===
                      'PENDING_VERIFICATION'
                    ? 'Your medical report is awaiting review.'
                    : 'You do not currently meet the preliminary criteria.'}
              </p>

              <ul className="eligibility-list">
                {data.eligibility.checks.map((check) => (
                  <li key={check.key}>
                    <span
                      className={
                        check.passed
                          ? 'check-pass'
                          : check.informational
                            ? 'check-info'
                            : 'check-fail'
                      }
                    >
                      {check.passed ? '✓' : '•'}
                    </span>
                    <span>
                      <strong>{check.label}</strong> —{' '}
                      {check.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="dashboard-card">
              <h2>Donor activities</h2>

              <ul className="donor-links">
                <li>
                  <Link to="/donor/profile">
                    Edit profile and consent
                  </Link>
                </li>
                <li>
                  <Link to="/donor/availability">
                    Manage availability
                  </Link>
                </li>
                <li>
                  <Link to="/donor/medical-reports">
                    Medical reports
                  </Link>
                </li>
                <li>
                  <Link to="/donor/history">
                    Donation history ({data.stats.totalDonations})
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

export default DonorDashboard
