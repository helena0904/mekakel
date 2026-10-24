import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  assignDonorReview,
  listReviewAssignments,
} from '../../services/admin.service'
import type {
  ReviewAssignmentDonor,
  ReviewDoctor,
} from '../../services/admin.service'
import {
  VERIFICATION_QUEUE_STATUS_LABELS,
  verificationStatusBadgeClass,
} from '../../services/doctor.service'
import type { VerificationQueueStatus } from '../../services/doctor.service'

const STATUS_OPTIONS = Object.keys(
  VERIFICATION_QUEUE_STATUS_LABELS
) as VerificationQueueStatus[]

function ReviewAssignmentsPage() {
  const [donors, setDonors] = useState<ReviewAssignmentDonor[]>(
    []
  )
  const [doctors, setDoctors] = useState<ReviewDoctor[]>([])
  const [statusFilter, setStatusFilter] =
    useState<VerificationQueueStatus>('ALL')
  const [selections, setSelections] = useState<
    Record<number, string>
  >({})
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState<number | null>(
    null
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const result = await listReviewAssignments({
          status: statusFilter,
        })

        if (!cancelled) {
          setDonors(result.donors)
          setDoctors(result.doctors)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load review assignments'
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
  }, [statusFilter])

  async function handleAssign(donorId: number) {
    const donor = donors.find((entry) => entry.id === donorId)
    const value =
      selections[donorId] ??
      (donor?.reviewAssignment
        ? String(donor.reviewAssignment.doctorUserId)
        : '')
    const doctorUserId = Number(value)

    if (!Number.isInteger(doctorUserId) || doctorUserId <= 0) {
      setError('Select a doctor for this review.')
      return
    }

    setAssigningId(donorId)
    setError('')
    setSuccess('')

    try {
      await assignDonorReview(donorId, doctorUserId)
      setSuccess('Review assigned.')

      const result = await listReviewAssignments({
        status: statusFilter,
      })

      setDonors(result.donors)
      setDoctors(result.doctors)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to assign the review'
      )
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/admin-dashboard" className="back-link">
          Back to dashboard
        </Link>

        <h1>Doctor review assignments</h1>

        <p className="section-description">
          Only the assigned doctor can view a donor's
          clinical profile, open medical reports, and record
          a verification decision. Reassigning a donor moves
          that access immediately.
        </p>

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
              <label htmlFor="review-status">
                Filter by verification status
              </label>
              <select
                id="review-status"
                value={statusFilter}
                onChange={(event) => {
                  setLoading(true)
                  setStatusFilter(
                    event.target.value as VerificationQueueStatus
                  )
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {VERIFICATION_QUEUE_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {doctors.length === 0 && (
          <p>
            There are no active doctor accounts to assign.
            Create or activate a doctor account first.
          </p>
        )}

        {loading && <p role="status">Loading...</p>}

        {!loading && donors.length === 0 && (
          <p>No donor registrations match this filter.</p>
        )}

        {!loading &&
          donors.map((donor) => {
            const selected =
              selections[donor.id] ??
              (donor.reviewAssignment
                ? String(donor.reviewAssignment.doctorUserId)
                : '')

            return (
              <section
                key={donor.id}
                className="dashboard-card"
              >
                <div className="section-heading">
                  <h2>{donor.user.name}</h2>

                  <span
                    className={verificationStatusBadgeClass(
                      donor.verificationStatus
                    )}
                  >
                    {VERIFICATION_QUEUE_STATUS_LABELS[
                      donor.verificationStatus
                    ] ?? donor.verificationStatus}
                  </span>
                </div>

                <p>{donor.user.email}</p>
                <p>
                  {donor.medicalReports.length} medical
                  report
                  {donor.medicalReports.length === 1
                    ? ''
                    : 's'}
                </p>
                <p>
                  Currently assigned:{' '}
                  {donor.reviewAssignment?.doctor.name ??
                    'Unassigned'}
                </p>

                <div className="filter-bar">
                  <div className="form-group">
                    <label htmlFor={`doctor-${donor.id}`}>
                      Assign doctor
                    </label>
                    <select
                      id={`doctor-${donor.id}`}
                      value={selected}
                      disabled={
                        doctors.length === 0 ||
                        assigningId !== null
                      }
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [donor.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select a doctor
                      </option>
                      {doctors.map((doctor) => (
                        <option
                          key={doctor.id}
                          value={doctor.id}
                        >
                          {doctor.name} ({doctor.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !selected || assigningId !== null
                    }
                    onClick={() => handleAssign(donor.id)}
                  >
                    {assigningId === donor.id
                      ? 'Assigning...'
                      : 'Assign review'}
                  </button>
                </div>
              </section>
            )
          })}
      </div>
    </main>
  )
}

export default ReviewAssignmentsPage
