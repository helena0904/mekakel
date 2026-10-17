import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  approveTransfer,
  canManageTransfers,
  cancelTransfer,
  completeTransfer,
  dispatchTransfer,
  getTransfer,
  receiveTransfer,
  rejectTransfer,
  TRANSFER_STATUS_LABELS,
  transferStatusBadgeClass,
} from '../../services/transfer.service'
import type { Transfer } from '../../services/transfer.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import { BLOOD_TYPE_LABELS } from '../../services/donor.service'
import { getHospitalProfile } from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString()
}

function TransferDetailsPage() {
  const { id } = useParams()

  const transferId = Number(id)
  const validId = Number.isInteger(transferId) && transferId > 0

  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [hospitalProfileId, setHospitalProfileId] =
    useState<number | null>(null)
  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const profile = await getHospitalProfile()

        if (!cancelled) {
          setRole(profile.role)
          setHospitalProfileId(profile.profile.id)
        }
      } catch {
        // Role only gates actions; failure is non-fatal.
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
        const loaded = await getTransfer(transferId)

        if (!cancelled) {
          setTransfer(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the transfer'
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
  }, [transferId, validId])

  async function runAction(
    action: () => Promise<Transfer>,
    message: string
  ) {
    if (!transfer || saving) {
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const updated = await action()
      setTransfer(updated)
      setSuccess(message)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the transfer'
      )
    } finally {
      setSaving(false)
    }
  }

  const canManage = canManageTransfers(role)

  const isIncoming =
    transfer !== null &&
    transfer.toHospitalProfileId === hospitalProfileId
  const isOutgoing =
    transfer !== null &&
    transfer.fromHospitalProfileId === hospitalProfileId

  const canApprove =
    canManage && isIncoming && transfer?.status === 'REQUESTED'
  const canDispatch =
    canManage && isOutgoing && transfer?.status === 'APPROVED'
  const canReceive =
    canManage && isIncoming && transfer?.status === 'DISPATCHED'
  const canComplete =
    canManage && isIncoming && transfer?.status === 'RECEIVED'
  const canCancel =
    canManage &&
    isOutgoing &&
    (transfer?.status === 'REQUESTED' ||
      transfer?.status === 'APPROVED')

  function handleReject() {
    const reason = window.prompt(
      'Reason for rejecting this transfer (optional):'
    )

    if (reason === null) {
      return
    }

    void runAction(
      () => rejectTransfer(transfer!.id, reason || undefined),
      'Transfer rejected.'
    )
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/hospital/transfers"
          className="back-link"
        >
          ← Back to transfers
        </Link>

        <h1>Transfer details</h1>

        {!validId && (
          <p className="register-error" role="alert">
            Invalid transfer id
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

        {validId && loading && <p role="status">Loading…</p>}

        {!loading && transfer && (
          <>
            <section className="dashboard-card">
              <div className="verification-status-header">
                <h2>Transfer #{transfer.id}</h2>

                <span
                  className={transferStatusBadgeClass(
                    transfer.status
                  )}
                >
                  {TRANSFER_STATUS_LABELS[transfer.status]}
                </span>
              </div>

              <p>
                Unit:{' '}
                <strong>{transfer.bloodUnit.bagId}</strong> ·{' '}
                {BLOOD_TYPE_LABELS[transfer.bloodUnit.bloodType]} ·{' '}
                {
                  BLOOD_COMPONENT_LABELS[
                    transfer.bloodUnit.component
                  ]
                }
              </p>

              <p>
                From:{' '}
                <strong>
                  {transfer.fromHospital.hospitalName}
                </strong>
              </p>

              <p>
                To:{' '}
                <strong>
                  {transfer.toHospital.hospitalName}
                </strong>
              </p>

              <p>
                Your direction:{' '}
                <strong>
                  {isIncoming
                    ? 'Incoming'
                    : isOutgoing
                      ? 'Outgoing'
                      : '—'}
                </strong>
              </p>

              {transfer.reason && (
                <p>Reason: {transfer.reason}</p>
              )}

              {transfer.notes && (
                <p className="cell-note">
                  Notes: {transfer.notes}
                </p>
              )}

              {transfer.rejectionReason && (
                <p className="register-error">
                  Rejection reason: {transfer.rejectionReason}
                </p>
              )}

              <p className="cell-note">
                Requested {formatDateTime(transfer.createdAt)} ·
                Approved {formatDateTime(transfer.approvedAt)} ·
                Dispatched {formatDateTime(transfer.dispatchedAt)} ·
                Received {formatDateTime(transfer.receivedAt)} ·
                Completed {formatDateTime(transfer.completedAt)}
              </p>
            </section>

            {canManage && (
              <section className="form-section">
                <h2>Actions</h2>

                <div className="form-actions">
                  {canApprove && (
                    <>
                      <button
                        type="button"
                        className="register-button"
                        disabled={saving}
                        onClick={() =>
                          runAction(
                            () => approveTransfer(transfer.id),
                            'Transfer approved.'
                          )
                        }
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        className="secondary-button danger-button"
                        disabled={saving}
                        onClick={handleReject}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {canDispatch && (
                    <button
                      type="button"
                      className="register-button"
                      disabled={saving}
                      onClick={() =>
                        runAction(
                          () => dispatchTransfer(transfer.id),
                          'Transfer dispatched.'
                        )
                      }
                    >
                      Mark dispatched
                    </button>
                  )}

                  {canReceive && (
                    <button
                      type="button"
                      className="register-button"
                      disabled={saving}
                      onClick={() =>
                        runAction(
                          () => receiveTransfer(transfer.id),
                          'Transfer marked as received.'
                        )
                      }
                    >
                      Mark received
                    </button>
                  )}

                  {canComplete && (
                    <button
                      type="button"
                      className="register-button"
                      disabled={saving}
                      onClick={() =>
                        runAction(
                          () => completeTransfer(transfer.id),
                          'Transfer completed.'
                        )
                      }
                    >
                      Complete transfer
                    </button>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      className="secondary-button danger-button"
                      disabled={saving}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Cancel this transfer?'
                          )
                        ) {
                          return
                        }

                        void runAction(
                          () => cancelTransfer(transfer.id),
                          'Transfer cancelled.'
                        )
                      }}
                    >
                      Cancel transfer
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="form-section">
              <h2>Audit history</h2>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Note</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transfer.events.map((event) => (
                      <tr key={event.id}>
                        <td>{formatDateTime(event.createdAt)}</td>
                        <td>
                          {event.fromStatus
                            ? TRANSFER_STATUS_LABELS[
                                event.fromStatus
                              ]
                            : '—'}
                        </td>
                        <td>
                          {
                            TRANSFER_STATUS_LABELS[
                              event.toStatus
                            ]
                          }
                        </td>
                        <td>{event.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!loading && !transfer && !error && validId && (
          <p>Transfer not found.</p>
        )}
      </div>
    </main>
  )
}

export default TransferDetailsPage
