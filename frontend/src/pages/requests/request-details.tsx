import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  canManageRequests,
  deleteRequest,
  getRequest,
  updateRequestStatus,
  BLOOD_REQUEST_STATUS_LABELS,
  REQUEST_URGENCY_LABELS,
  requestStatusBadgeClass,
} from '../../services/blood-request.service'
import type {
  BloodRequest,
  BloodRequestStatusValue,
} from '../../services/blood-request.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import { getHospitalProfile } from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'

function RequestDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const requestId = Number(id)

  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [request, setRequest] =
    useState<BloodRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const validId = Number.isInteger(requestId) && requestId > 0

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const profile = await getHospitalProfile()

        if (!cancelled) {
          setRole(profile.role)
        }
      } catch {
        // Role is only used to gate actions; failure is non-fatal.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!validId) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const loaded = await getRequest(requestId)

        if (!cancelled) {
          setRequest(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the blood request'
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
  }, [requestId, validId])

  async function changeStatus(
    status: BloodRequestStatusValue
  ) {
    if (!request || saving) {
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const updated = await updateRequestStatus(
        request.id,
        status
      )

      setRequest(updated)
      setSuccess('Request status updated.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the blood request'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!request) {
      return
    }

    if (
      !window.confirm('Delete this blood request?')
    ) {
      return
    }

    setError('')

    try {
      await deleteRequest(request.id)
      navigate('/hospital/requests', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete the blood request'
      )
    }
  }

  const canManage = canManageRequests(role)

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/hospital/requests"
          className="back-link"
        >
          ← Back to requests
        </Link>

        <h1>Blood request details</h1>

        {!validId && (
          <p className="register-error" role="alert">
            Invalid blood request id
          </p>
        )}

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

        {validId && loading && (
          <p role="status">Loading…</p>
        )}

        {!loading && request && (
          <>
            <section className="dashboard-card">
              <div className="verification-status-header">
                <h2>
                  Request #{request.id}
                </h2>

                <span
                  className={requestStatusBadgeClass(
                    request.status
                  )}
                >
                  {
                    BLOOD_REQUEST_STATUS_LABELS[
                      request.status
                    ]
                  }
                </span>
              </div>

              <p>
                Component:{' '}
                <strong>
                  {BLOOD_COMPONENT_LABELS[request.component]}
                </strong>
              </p>

              <p>
                Blood type:{' '}
                <strong>
                  {BLOOD_TYPE_LABELS[request.bloodType]}
                </strong>
              </p>

              <p>
                Required units:{' '}
                <strong>{request.requiredUnits}</strong>
              </p>

              <p>
                Urgency:{' '}
                <strong>
                  {REQUEST_URGENCY_LABELS[request.urgency]}
                </strong>
              </p>

              <p>Location: {request.location || '—'}</p>

              {request.notes && (
                <p className="cell-note">
                  Notes: {request.notes}
                </p>
              )}

              <p className="cell-note">
                Created {formatDate(request.createdAt)}
              </p>
            </section>

            <section className="form-section">
              <h2>Actions</h2>

              <div className="form-actions">
                <Link
                  to={`/hospital/requests/${request.id}/matches`}
                  className="secondary-button"
                >
                  View matching sources
                </Link>

                {canManage &&
                  request.status === 'OPEN' && (
                    <>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          changeStatus('FULFILLED')
                        }
                        disabled={saving}
                      >
                        Mark fulfilled
                      </button>

                      <button
                        type="button"
                        className="secondary-button danger-button"
                        onClick={() =>
                          changeStatus('CANCELLED')
                        }
                        disabled={saving}
                      >
                        Cancel request
                      </button>
                    </>
                  )}

                {canManage &&
                  request.status !== 'OPEN' && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => changeStatus('OPEN')}
                      disabled={saving}
                    >
                      Reopen request
                    </button>
                  )}

                {canManage && (
                  <button
                    type="button"
                    className="secondary-button danger-button"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    Delete
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {!loading && !request && !error && (
          <p>Blood request not found.</p>
        )}
      </div>
    </main>
  )
}

export default RequestDetailsPage
