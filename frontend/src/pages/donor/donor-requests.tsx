import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import {
  DONOR_RESPONSE_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  getDonorReservations,
  recordDonorResponse,
  reservationStatusBadgeClass,
} from '../../services/reservation.service'
import type { Reservation } from '../../services/reservation.service'

function DonorRequestsPage() {
  const [reservations, setReservations] = useState<
    Reservation[]
  >([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getDonorReservations()

        if (!cancelled) {
          setReservations(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your requests'
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

  async function respond(
    reservation: Reservation,
    donorResponse: 'ACCEPTED' | 'DECLINED'
  ) {
    if (busyId !== null) {
      return
    }

    setError('')
    setSuccess('')
    setBusyId(reservation.id)

    try {
      const updated = await recordDonorResponse(
        reservation.id,
        donorResponse
      )

      setReservations((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
      setSuccess(
        donorResponse === 'ACCEPTED'
          ? 'Request accepted. The hospital can now contact you.'
          : 'Request declined.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to record your response'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/donor-dashboard"
          className="back-link"
        >
          Back to dashboard
        </Link>

        <h1>Blood Requests</h1>

        <p>
          Hospitals can reserve you for a blood request. Accept
          only if you are able to donate at the stated hospital.
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

        {loading && <p role="status">Loading...</p>}

        {!loading && reservations.length === 0 && (
          <p>You have no hospital requests yet.</p>
        )}

        {reservations.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Blood type</th>
                  <th>Status</th>
                  <th>Your response</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {reservations.map((reservation) => {
                  const canRespond =
                    reservation.status === 'ACTIVE' &&
                    reservation.donorResponse === 'PENDING' &&
                    !reservation.isExpired

                  const bloodType =
                    reservation.bloodUnit?.bloodType ??
                    reservation.donorProfile?.bloodType ??
                    reservation.bloodRequest?.bloodType

                  return (
                    <tr key={reservation.id}>
                      <td>
                        <span className="cell-note">
                          {
                            reservation.hospitalProfile
                              .hospitalName
                          }
                        </span>
                        <span className="cell-note">
                          {
                            reservation.hospitalProfile
                              .address
                          }
                        </span>
                        <span className="cell-note">
                          {reservation.hospitalProfile.phone}
                        </span>
                      </td>
                      <td>
                        {bloodType
                          ? BLOOD_TYPE_LABELS[bloodType]
                          : '-'}
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
                        {
                          DONOR_RESPONSE_STATUS_LABELS[
                            reservation.donorResponse
                          ]
                        }
                      </td>
                      <td>{formatDate(reservation.expiresAt)}</td>
                      <td className="table-actions">
                        {canRespond ? (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={busyId !== null}
                              onClick={() =>
                                respond(
                                  reservation,
                                  'ACCEPTED'
                                )
                              }
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              disabled={busyId !== null}
                              onClick={() =>
                                respond(
                                  reservation,
                                  'DECLINED'
                                )
                              }
                            >
                              Decline
                            </button>
                          </>
                        ) : reservation.donorResponse ===
                          'ACCEPTED' ? (
                          <span className="cell-note">
                            Contact the hospital to arrange
                            your donation.
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

export default DonorRequestsPage
