import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatDate } from '../../services/donor.service'
import {
  listVerificationQueue,
  VERIFICATION_QUEUE_STATUS_LABELS,
  verificationStatusBadgeClass,
} from '../../services/doctor.service'
import type {
  VerificationQueueItem,
  VerificationQueueStatus,
} from '../../services/doctor.service'

const STATUS_OPTIONS: VerificationQueueStatus[] = [
  'PENDING',
  'ADDITIONAL_INFO_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'ALL',
]

function VerificationQueuePage() {
  const [donors, setDonors] = useState<
    VerificationQueueItem[]
  >([])
  const [status, setStatus] =
    useState<VerificationQueueStatus>('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await listVerificationQueue({ status })

        if (!cancelled) {
          setDonors(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the verification queue'
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
  }, [status])

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/doctor-dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <h1>Medical verification queue</h1>

        <p>
          Review donor medical reports and record an authorized
          clinical decision. Only donors assigned to you by an
          administrator appear here, and every decision is
          auditable.
        </p>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        <section className="form-section">
          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="queue-status">Status</label>
              <select
                id="queue-status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as VerificationQueueStatus
                  )
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {
                      VERIFICATION_QUEUE_STATUS_LABELS[
                        option
                      ]
                    }
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && <p role="status">Loading…</p>}

        {!loading && donors.length === 0 && (
          <p>
            No assigned donor reports match this filter.
          </p>
        )}

        {donors.length > 0 && (
          <ul className="notification-list">
            {donors.map((donor) => (
              <li key={donor.id} className="notification-item">
                <div className="notification-item-header">
                  <strong>{donor.user.name}</strong>

                  <span
                    className={verificationStatusBadgeClass(
                      donor.verificationStatus
                    )}
                  >
                    {donor.verificationStatus ===
                    'ADDITIONAL_INFO_REQUIRED'
                      ? 'Additional info'
                      : donor.verificationStatus}
                  </span>
                </div>

                <p className="notification-body">
                  {donor.bloodType ?? 'Blood type not set'} ·{' '}
                  {donor.weight} kg ·{' '}
                  {donor.medicalReports.length} report
                  {donor.medicalReports.length === 1 ? '' : 's'}
                </p>

                <div className="notification-item-footer">
                  <span>
                    Submitted {formatDate(donor.createdAt)}
                  </span>

                  <Link
                    to={`/doctor/verifications/${donor.id}`}
                    className="secondary-button"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

export default VerificationQueuePage
