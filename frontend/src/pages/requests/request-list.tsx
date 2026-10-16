import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  canManageRequests,
  getRequests,
  BLOOD_REQUEST_STATUS_LABELS,
  REQUEST_URGENCY_LABELS,
  requestStatusBadgeClass,
} from '../../services/blood-request.service'
import type {
  BloodRequest,
  BloodRequestFilters,
  BloodRequestStatusValue,
} from '../../services/blood-request.service'
import type {
  BloodComponent,
  BloodType,
} from '../../services/inventory.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import { getHospitalProfile } from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

const BLOOD_COMPONENT_OPTIONS = Object.keys(
  BLOOD_COMPONENT_LABELS
) as BloodComponent[]

const STATUS_OPTIONS = Object.keys(
  BLOOD_REQUEST_STATUS_LABELS
) as BloodRequestStatusValue[]

function RequestListPage() {
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [requests, setRequests] = useState<BloodRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState<BloodRequestFilters>(
    {
      status: 'OPEN',
    }
  )

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const profile = await getHospitalProfile()

        if (!cancelled) {
          setRole(profile.role)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your hospital profile'
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getRequests(filters)

        if (!cancelled) {
          setRequests(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load blood requests'
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
  }, [filters])

  const canManage = canManageRequests(role)

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/hospital-dashboard"
          className="back-link"
        >
          ← Back to dashboard
        </Link>

        <div className="section-header">
          <h1>Blood requests</h1>

          {canManage && (
            <Link
              to="/hospital/requests/new"
              className="secondary-button"
            >
              New request
            </Link>
          )}
        </div>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        <section className="form-section">
          <h2>Filters</h2>

          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="request-filter-status">
                Status
              </label>
              <select
                id="request-filter-status"
                value={filters.status ?? ''}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status:
                      (event.target
                        .value as BloodRequestStatusValue) ||
                      undefined,
                  }))
                }
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {BLOOD_REQUEST_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="request-filter-type">
                Blood type
              </label>
              <select
                id="request-filter-type"
                value={filters.bloodType ?? ''}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    bloodType:
                      (event.target.value as BloodType) ||
                      undefined,
                  }))
                }
              >
                <option value="">All types</option>
                {BLOOD_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {BLOOD_TYPE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="request-filter-component">
                Component
              </label>
              <select
                id="request-filter-component"
                value={filters.component ?? ''}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    component:
                      (event.target
                        .value as BloodComponent) ||
                      undefined,
                  }))
                }
              >
                <option value="">All components</option>
                {BLOOD_COMPONENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {BLOOD_COMPONENT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Requests</h2>

          {loading && <p role="status">Loading…</p>}

          {!loading && requests.length === 0 && (
            <p>No blood requests match the current filters.</p>
          )}

          {requests.length > 0 && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Component</th>
                    <th>Type</th>
                    <th>Units</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((bloodRequest) => (
                    <tr key={bloodRequest.id}>
                      <td>
                        {formatDate(bloodRequest.createdAt)}
                      </td>

                      <td>
                        {
                          BLOOD_COMPONENT_LABELS[
                            bloodRequest.component
                          ]
                        }
                      </td>

                      <td>
                        {
                          BLOOD_TYPE_LABELS[
                            bloodRequest.bloodType
                          ]
                        }
                      </td>

                      <td>{bloodRequest.requiredUnits}</td>

                      <td>
                        {
                          REQUEST_URGENCY_LABELS[
                            bloodRequest.urgency
                          ]
                        }
                      </td>

                      <td>
                        <span
                          className={requestStatusBadgeClass(
                            bloodRequest.status
                          )}
                        >
                          {
                            BLOOD_REQUEST_STATUS_LABELS[
                              bloodRequest.status
                            ]
                          }
                        </span>
                      </td>

                      <td className="table-actions">
                        <Link
                          to={`/hospital/requests/${bloodRequest.id}`}
                          className="secondary-button"
                        >
                          Details
                        </Link>

                        <Link
                          to={`/hospital/requests/${bloodRequest.id}/matches`}
                          className="secondary-button"
                        >
                          Matches
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default RequestListPage
