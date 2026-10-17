import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  listHospitalApprovals,
  reviewHospitalApproval,
} from '../../services/admin.service'
import {
  HOSPITAL_STATUS_LABELS,
  hospitalStatusBadgeClass,
} from '../../services/hospital.service'
import type {
  HospitalProfile,
  HospitalStatusValue,
} from '../../services/hospital.service'
import type { ReviewHospitalInput } from '../../services/hospital.service'

type Decision = ReviewHospitalInput['decision']

const DECISION_LABELS: Record<Decision, string> = {
  APPROVE: 'Approve',
  ACTIVATE: 'Re-activate',
  SUSPEND: 'Suspend',
  REJECT: 'Reject',
}

const STATUS_OPTIONS: HospitalStatusValue[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
]

function HospitalApprovalsPage() {
  const [hospitals, setHospitals] = useState<
    HospitalProfile[]
  >([])
  const [statusFilter, setStatusFilter] = useState<
    HospitalStatusValue | ''
  >('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [pending, setPending] = useState<{
    hospitalId: number
    decision: Decision
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const loaded = await listHospitalApprovals()
      setHospitals(loaded)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load hospital registrations'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await listHospitalApprovals()

        if (!cancelled) {
          setHospitals(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load hospital registrations'
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

  const visible = statusFilter
    ? hospitals.filter(
        (hospital) => hospital.status === statusFilter
      )
    : hospitals

  function beginDecision(
    hospitalId: number,
    decision: Decision
  ) {
    setPending({ hospitalId, decision })
    setNotes('')
    setError('')
    setSuccess('')
  }

  async function submitDecision() {
    if (!pending || submitting) {
      return
    }

    if (
      (pending.decision === 'REJECT' ||
        pending.decision === 'SUSPEND') &&
      notes.trim().length === 0
    ) {
      setError('A reason is required for this decision.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await reviewHospitalApproval(pending.hospitalId, {
        decision: pending.decision,
        notes: notes.trim() || undefined,
      })

      setPending(null)
      setNotes('')
      setSuccess('Hospital registration updated.')
      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the registration'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/admin-dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <h1>Hospital registrations</h1>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="register-success" role="status">
            {success}
          </p>
        )}

        <section className="form-section">
          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="hospital-status">
                Filter by status
              </label>
              <select
                id="hospital-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | HospitalStatusValue
                      | ''
                  )
                }
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {HOSPITAL_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && <p role="status">Loading…</p>}

        {!loading && visible.length === 0 && (
          <p>No hospital registrations match this filter.</p>
        )}

        {visible.map((hospital) => (
          <section
            key={hospital.id}
            className="dashboard-card"
          >
            <div className="section-heading">
              <h2>{hospital.hospitalName}</h2>

              <span
                className={hospitalStatusBadgeClass(
                  hospital.status
                )}
              >
                {HOSPITAL_STATUS_LABELS[hospital.status]}
              </span>
            </div>

            <p>Address: {hospital.address}</p>
            <p>Phone: {hospital.phone}</p>

            {hospital.user && (
              <p>
                Contact: {hospital.user.name} (
                {hospital.user.email})
              </p>
            )}

            {hospital.reviewNotes && (
              <p className="verification-notes">
                Reviewer note: {hospital.reviewNotes}
              </p>
            )}

            {pending?.hospitalId === hospital.id ? (
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor={`notes-${hospital.id}`}>
                    Reviewer note
                  </label>
                  <textarea
                    id={`notes-${hospital.id}`}
                    value={notes}
                    maxLength={500}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                  />
                </div>

                <div className="section-heading">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submitDecision}
                  >
                    {submitting
                      ? 'Saving…'
                      : `Confirm ${DECISION_LABELS[
                          pending.decision
                        ].toLowerCase()}`}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => setPending(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="section-heading">
                {hospital.status !== 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() =>
                      beginDecision(hospital.id, 'APPROVE')
                    }
                  >
                    Approve
                  </button>
                )}

                {hospital.status === 'SUSPENDED' && (
                  <button
                    type="button"
                    onClick={() =>
                      beginDecision(hospital.id, 'ACTIVATE')
                    }
                  >
                    Re-activate
                  </button>
                )}

                {hospital.status === 'APPROVED' && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      beginDecision(hospital.id, 'SUSPEND')
                    }
                  >
                    Suspend
                  </button>
                )}

                {hospital.status !== 'REJECTED' && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      beginDecision(hospital.id, 'REJECT')
                    }
                  >
                    Reject
                  </button>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}

export default HospitalApprovalsPage
