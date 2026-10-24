import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  canManageReservations,
  cancelReservation,
  confirmReservation,
  consumeReservation,
  createReservation,
  getReservations,
  releaseReservation,
  isReservationOpen,
  DONOR_RESPONSE_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  reservationStatusBadgeClass,
} from '../../services/reservation.service'
import type {
  Reservation,
  ReservationStatusValue,
} from '../../services/reservation.service'
import { getUnits } from '../../services/inventory.service'
import type { BloodUnit } from '../../services/inventory.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import { getRequests } from '../../services/blood-request.service'
import type { BloodRequest } from '../../services/blood-request.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import { getHospitalProfile } from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'

const STATUS_OPTIONS = Object.keys(
  RESERVATION_STATUS_LABELS
) as ReservationStatusValue[]

const DEFAULT_TTL_MINUTES = 1440

function ReservationsPage() {
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)

  const [reservations, setReservations] = useState<
    Reservation[]
  >([])
  const [units, setUnits] = useState<BloodUnit[]>([])
  const [requests, setRequests] = useState<BloodRequest[]>([])

  const [filters, setFilters] = useState<{
    status: ReservationStatusValue | ''
  }>({ status: '' })

  const [bloodUnitId, setBloodUnitId] = useState('')
  const [bloodRequestId, setBloodRequestId] = useState('')
  const [donorProfileId, setDonorProfileId] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState(
    String(DEFAULT_TTL_MINUTES)
  )
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = canManageReservations(role)

  async function reload() {
    const loaded = await getReservations(
      filters.status ? { status: filters.status } : {}
    )
    setReservations(loaded)
  }

  async function reloadFormOptions() {
    const [availableUnits, openRequests] = await Promise.all([
      getUnits({ availability: 'available' }),
      getRequests({ status: 'OPEN' }),
    ])
    setUnits(availableUnits)
    setRequests(openRequests)
  }

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
        const [loaded, availableUnits, openRequests] =
          await Promise.all([
            getReservations(
              filters.status ? { status: filters.status } : {}
            ),
            getUnits({ availability: 'available' }),
            getRequests({ status: 'OPEN' }),
          ])

        if (cancelled) {
          return
        }

        setReservations(loaded)
        setUnits(availableUnits)
        setRequests(openRequests)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load reservations'
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

  async function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    if (!bloodUnitId && !donorProfileId) {
      setError(
        'Select a blood unit or enter a donor profile to coordinate'
      )
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await createReservation({
        bloodUnitId: bloodUnitId
          ? Number(bloodUnitId)
          : undefined,
        bloodRequestId: bloodRequestId
          ? Number(bloodRequestId)
          : undefined,
        donorProfileId: donorProfileId
          ? Number(donorProfileId)
          : undefined,
        expiresInMinutes: expiresInMinutes
          ? Number(expiresInMinutes)
          : undefined,
        notes: notes.trim() || undefined,
      })

      setSuccess(
        bloodUnitId
          ? 'Blood unit reserved.'
          : 'Donor coordination started.'
      )
      setBloodUnitId('')
      setBloodRequestId('')
      setDonorProfileId('')
      setNotes('')
      setExpiresInMinutes(String(DEFAULT_TTL_MINUTES))
      await reload()
      await reloadFormOptions()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reserve the blood unit'
      )
    } finally {
      setSaving(false)
    }
  }

  async function runAction(
    reservation: Reservation,
    action: () => Promise<Reservation>,
    message: string
  ) {
    if (busyId !== null) {
      return
    }

    setError('')
    setSuccess('')
    setBusyId(reservation.id)

    try {
      const updated = await action()
      setReservations((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
      setSuccess(message)
      await reloadFormOptions()

      if (filters.status) {
        await reload()
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the reservation'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/hospital-dashboard"
          className="back-link"
        >
          ← Back to dashboard
        </Link>

        <h1>Reservations</h1>

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

        {!loading && !canManage && (
          <section className="dashboard-card">
            <p>
              Only hospital owners, administrators,
              managers and technicians can manage
              reservations.
            </p>
          </section>
        )}

        {canManage && (
          <form
            className="register-form"
            onSubmit={handleCreate}
          >
            <section className="form-section">
              <h2>Start a reservation</h2>

              <p className="section-description">
                Select an available unit, a donor profile, or
                both. Donor-only reservations track the donor's
                response without holding a specific unit.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reservation-unit">
                    Blood unit (optional)
                  </label>
                  <select
                    id="reservation-unit"
                    value={bloodUnitId}
                    onChange={(event) =>
                      setBloodUnitId(event.target.value)
                    }
                    disabled={saving}
                  >
                    <option value="">
                      No specific unit (donor only)
                    </option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.bagId} ·{' '}
                        {BLOOD_TYPE_LABELS[unit.bloodType]} ·{' '}
                        {
                          BLOOD_COMPONENT_LABELS[
                            unit.component
                          ]
                        }
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reservation-request">
                    Blood request (optional)
                  </label>
                  <select
                    id="reservation-request"
                    value={bloodRequestId}
                    onChange={(event) =>
                      setBloodRequestId(event.target.value)
                    }
                    disabled={saving}
                  >
                    <option value="">No linked request</option>
                    {requests.map((request) => (
                      <option key={request.id} value={request.id}>
                        #{request.id} ·{' '}
                        {BLOOD_TYPE_LABELS[request.bloodType]}{' '}
                        · {request.requiredUnits} unit(s)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reservation-donor">
                    Donor profile ID (optional)
                  </label>
                  <input
                    id="reservation-donor"
                    type="number"
                    min="1"
                    value={donorProfileId}
                    onChange={(event) =>
                      setDonorProfileId(event.target.value)
                    }
                    disabled={saving}
                    placeholder="Required for donor-only coordination"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reservation-ttl">
                    Hold for (minutes)
                  </label>
                  <input
                    id="reservation-ttl"
                    type="number"
                    min="5"
                    max="10080"
                    value={expiresInMinutes}
                    onChange={(event) =>
                      setExpiresInMinutes(event.target.value)
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reservation-notes">
                  Notes
                </label>
                <input
                  id="reservation-notes"
                  type="text"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  disabled={saving}
                />
              </div>

              <button
                type="submit"
                className="register-button"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Create reservation'}
              </button>
            </section>
          </form>
        )}

        <section className="form-section">
          <h2>Filter reservations</h2>

          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="reservation-filter-status">
                Status
              </label>
              <select
                id="reservation-filter-status"
                value={filters.status}
                onChange={(event) =>
                  setFilters({
                    status: event.target
                      .value as ReservationStatusValue | '',
                  })
                }
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {RESERVATION_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Reservations</h2>

          {loading && <p role="status">Loading…</p>}

          {!loading && reservations.length === 0 && (
            <p>No reservations match the current filters.</p>
          )}

          {reservations.length > 0 && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Type</th>
                    <th>Component</th>
                    <th>Status</th>
                    <th>Donor</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {reservations.map((reservation) => {
                    const open =
                      isReservationOpen(reservation)

                    return (
                      <tr key={reservation.id}>
                        <td>
                          {reservation.bloodUnit
                            ? reservation.bloodUnit.bagId
                            : 'Donor coordination'}
                        </td>
                        <td>
                          {reservation.bloodUnit
                            ? BLOOD_TYPE_LABELS[
                                reservation.bloodUnit.bloodType
                              ]
                            : reservation.donorProfile?.bloodType
                              ? BLOOD_TYPE_LABELS[
                                  reservation.donorProfile
                                    .bloodType
                                ]
                              : '—'}
                        </td>
                        <td>
                          {reservation.bloodUnit
                            ? BLOOD_COMPONENT_LABELS[
                                reservation.bloodUnit.component
                              ]
                            : '—'}
                        </td>
                        <td>
                          <span
                            className={reservationStatusBadgeClass(
                              reservation.status
                            )}
                          >
                            {
                              RESERVATION_STATUS_LABELS[
                                reservation.status
                              ]
                            }
                          </span>
                        </td>
                        <td>
                          {reservation.donorProfileId ? (
                            <>
                              <span className="cell-note">
                                {reservation.donorProfile
                                  ? reservation.donorProfile.user
                                      .name
                                  : `Donor #${reservation.donorProfileId}`}
                              </span>
                              <span className="status-badge status-badge-info">
                                {
                                  DONOR_RESPONSE_STATUS_LABELS[
                                    reservation.donorResponse
                                  ]
                                }
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{formatDate(reservation.expiresAt)}</td>
                        <td className="table-actions">
                          {open && canManage && (
                            <>
                              {reservation.status ===
                                'ACTIVE' && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={busyId !== null}
                                  onClick={() =>
                                    runAction(
                                      reservation,
                                      () =>
                                        confirmReservation(
                                          reservation.id
                                        ),
                                      'Reservation confirmed.'
                                    )
                                  }
                                >
                                  Confirm
                                </button>
                              )}

                              {reservation.bloodUnit && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={busyId !== null}
                                  onClick={() =>
                                    runAction(
                                      reservation,
                                      () =>
                                        consumeReservation(
                                          reservation.id
                                        ),
                                      'Reserved unit marked as used.'
                                    )
                                  }
                                >
                                  Use
                                </button>
                              )}

                              <button
                                type="button"
                                className="secondary-button"
                                disabled={busyId !== null}
                                onClick={() =>
                                  runAction(
                                    reservation,
                                    () =>
                                      releaseReservation(
                                        reservation.id
                                      ),
                                    'Reservation released.'
                                  )
                                }
                              >
                                Release
                              </button>

                              <button
                                type="button"
                                className="secondary-button danger-button"
                                disabled={busyId !== null}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      'Cancel this reservation?'
                                    )
                                  ) {
                                    return
                                  }

                                  void runAction(
                                    reservation,
                                    () =>
                                      cancelReservation(
                                        reservation.id
                                      ),
                                    'Reservation cancelled.'
                                  )
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default ReservationsPage
