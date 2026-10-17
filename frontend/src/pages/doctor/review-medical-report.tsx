import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  fetchReportObjectUrl,
  getVerification,
  reviewVerification,
  verificationStatusBadgeClass,
} from '../../services/doctor.service'
import type {
  DonorReviewDecision,
  VerificationDetail,
} from '../../services/doctor.service'

const DECISIONS: Array<{
  decision: DonorReviewDecision
  label: string
  requiresNotes: boolean
}> = [
  { decision: 'VERIFY', label: 'Approve', requiresNotes: false },
  {
    decision: 'REQUEST_INFO',
    label: 'Request more information',
    requiresNotes: true,
  },
  { decision: 'REJECT', label: 'Reject', requiresNotes: true },
]

function ReviewMedicalReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] =
    useState<VerificationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openingReportId, setOpeningReportId] = useState<
    number | null
  >(null)

  const donorProfileId = Number(id)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getVerification(donorProfileId)

        if (!cancelled) {
          setDetail(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the donor verification'
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
  }, [donorProfileId])

  async function handleOpenReport(reportId: number) {
    if (openingReportId !== null) {
      return
    }

    setOpeningReportId(reportId)
    setError('')

    try {
      const objectUrl = await fetchReportObjectUrl(reportId)
      window.open(objectUrl, '_blank', 'noopener')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open the medical report'
      )
    } finally {
      setOpeningReportId(null)
    }
  }

  async function handleDecision(
    decision: DonorReviewDecision,
    requiresNotes: boolean
  ) {
    if (submitting) {
      return
    }

    if (requiresNotes && notes.trim().length === 0) {
      setError('A reason is required for this decision.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await reviewVerification(donorProfileId, {
        decision,
        notes: notes.trim() || undefined,
      })

      navigate('/doctor/verifications')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to record the decision'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/doctor/verifications" className="back-link">
          ← Back to queue
        </Link>

        <h1>Review medical report</h1>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {loading && <p role="status">Loading…</p>}

        {detail && (
          <>
            <section className="dashboard-card">
              <div className="section-heading">
                <h2>{detail.donor.user.name}</h2>

                <span
                  className={verificationStatusBadgeClass(
                    detail.donor.verificationStatus
                  )}
                >
                  {detail.donor.verificationStatus}
                </span>
              </div>

              <p>Email: {detail.donor.user.email}</p>
              <p>Phone: {detail.donor.phone}</p>
              <p>Address: {detail.donor.address}</p>
              <p>
                Blood type:{' '}
                {detail.donor.bloodType ?? 'Not recorded'}
              </p>
              <p>
                Weight: {detail.donor.weight} kg · Height:{' '}
                {detail.donor.height} cm
              </p>

              {detail.donor.dateOfBirth && (
                <p>
                  Date of birth:{' '}
                  {detail.donor.dateOfBirth.slice(0, 10)}
                </p>
              )}
            </section>

            <section className="dashboard-card">
              <h2>Preliminary screening</h2>

              <p>
                Non-clinical rule-of-thumb checks. Final
                eligibility is your clinical decision.
              </p>

              <ul className="donor-links">
                {detail.eligibility.checks.map((check) => (
                  <li key={check.key}>
                    {check.passed ? '✓' : '✕'} {check.label} —{' '}
                    <small>{check.detail}</small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="dashboard-card">
              <h2>Medical reports</h2>

              {detail.donor.medicalReports.length === 0 && (
                <p>No medical reports were uploaded.</p>
              )}

              <ul className="donor-links">
                {detail.donor.medicalReports.map((report) => (
                  <li key={report.id}>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={openingReportId !== null}
                      onClick={() => handleOpenReport(report.id)}
                    >
                      {openingReportId === report.id
                        ? 'Opening…'
                        : `Open ${report.reportType.toLowerCase()} report`}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="form-section">
              <h2>Record decision</h2>

              <div className="form-group">
                <label htmlFor="review-notes">
                  Notes / reason
                </label>
                <textarea
                  id="review-notes"
                  value={notes}
                  maxLength={500}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                />
              </div>

              <div className="section-heading">
                {DECISIONS.map((entry) => (
                  <button
                    key={entry.decision}
                    type="button"
                    className={
                      entry.decision === 'VERIFY'
                        ? undefined
                        : 'secondary-button'
                    }
                    disabled={submitting}
                    onClick={() =>
                      handleDecision(
                        entry.decision,
                        entry.requiresNotes
                      )
                    }
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default ReviewMedicalReportPage
