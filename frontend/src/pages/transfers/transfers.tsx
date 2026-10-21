import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  canManageTransfers,
  createTransfer,
  getTransferDestinations,
  getTransfers,
  transferDirection,
  transferStatusBadgeClass,
  TRANSFER_STATUS_LABELS,
} from '../../services/transfer.service'
import type {
  Transfer,
  TransferDestination,
  TransferFilters,
  TransferStatusValue,
} from '../../services/transfer.service'
import {
  BLOOD_COMPONENT_LABELS,
  getUnits,
} from '../../services/inventory.service'
import type { BloodUnit } from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import type { BloodType } from '../../services/donor.service'
import { getHospitalProfile } from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'

const STATUS_OPTIONS = Object.keys(
  TRANSFER_STATUS_LABELS
) as TransferStatusValue[]

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

function TransfersPage() {
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [hospitalProfileId, setHospitalProfileId] =
    useState<number | null>(null)

  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [units, setUnits] = useState<BloodUnit[]>([])
  const [destinations, setDestinations] = useState<
    TransferDestination[]
  >([])

  const [filters, setFilters] = useState<TransferFilters>({})

  const [bloodType, setBloodType] = useState<BloodType | ''>('')
  const [bloodUnitId, setBloodUnitId] = useState('')
  const [toHospitalProfileId, setToHospitalProfileId] =
    useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = canManageTransfers(role)

  const selectableUnits = units.filter(
    (unit) =>
      (unit.status === 'AVAILABLE' ||
        unit.status === 'RESERVED') &&
      unit.screeningStatus === 'PASSED' &&
      unit.bloodTypeConfirmed &&
      !unit.isExpired
  )

  const selectableUnitsByType = selectableUnits.filter(
    (unit) => unit.bloodType === bloodType
  )

  const selectedUnit = selectableUnitsByType.find(
    (unit) => String(unit.id) === bloodUnitId
  )

  async function reloadFormOptions() {
    const [loadedUnits, loadedDestinations] = await Promise.all([
      getUnits({ availability: 'all' }),
      getTransferDestinations(),
    ])

    setUnits(loadedUnits)
    setDestinations(loadedDestinations)
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const profile = await getHospitalProfile()

        if (!cancelled) {
          setRole(profile.role)
          setHospitalProfileId(profile.profile.id)
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
        const [loadedTransfers, loadedUnits, loadedDestinations] =
          await Promise.all([
            getTransfers(filters),
            getUnits({ availability: 'all' }),
            getTransferDestinations(),
          ])

        if (cancelled) {
          return
        }

        setTransfers(loadedTransfers)
        setUnits(loadedUnits)
        setDestinations(loadedDestinations)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load transfers'
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

    if (!bloodType || !bloodUnitId || !toHospitalProfileId) {
      setError(
        'Select the blood type, blood ID and destination hospital'
      )
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await createTransfer({
        bloodUnitId: Number(bloodUnitId),
        toHospitalProfileId: Number(toHospitalProfileId),
      })

      setSuccess('Transfer requested.')
      setBloodType('')
      setBloodUnitId('')
      setToHospitalProfileId('')

      const loaded = await getTransfers(filters)
      setTransfers(loaded)
      await reloadFormOptions()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to request the transfer'
      )
    } finally {
      setSaving(false)
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

        <h1>Hospital transfers</h1>

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
              managers and technicians can manage transfers.
            </p>
          </section>
        )}

        {canManage && (
          <form
            className="register-form"
            onSubmit={handleCreate}
          >
            <section className="form-section">
              <h2>Request a transfer</h2>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="transfer-blood-type">
                    Blood type
                  </label>
                  <select
                    id="transfer-blood-type"
                    value={bloodType}
                    onChange={(event) => {
                      setBloodType(
                        event.target.value as BloodType | ''
                      )
                      setBloodUnitId('')
                    }}
                    required
                    disabled={saving}
                  >
                    <option value="">
                      Select the blood type
                    </option>
                    {BLOOD_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {BLOOD_TYPE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="transfer-unit">
                    Blood ID
                  </label>
                  <select
                    id="transfer-unit"
                    value={bloodUnitId}
                    onChange={(event) =>
                      setBloodUnitId(event.target.value)
                    }
                    required
                    disabled={saving || !bloodType}
                  >
                    <option value="">
                      {bloodType
                        ? 'Select a blood ID'
                        : 'Select a blood type first'}
                    </option>
                    {selectableUnitsByType.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.bagId} ·{' '}
                        {
                          BLOOD_COMPONENT_LABELS[
                            unit.component
                          ]
                        }{' '}
                        ({unit.status.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="transfer-collection-date">
                    Collection date
                  </label>
                  <input
                    id="transfer-collection-date"
                    type="date"
                    value={
                      selectedUnit
                        ? selectedUnit.collectionDate.slice(0, 10)
                        : ''
                    }
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="transfer-destination">
                    Destination hospital
                  </label>
                  <select
                    id="transfer-destination"
                    value={toHospitalProfileId}
                    onChange={(event) =>
                      setToHospitalProfileId(event.target.value)
                    }
                    required
                    disabled={saving}
                  >
                    <option value="">
                      Select a destination
                    </option>
                    {destinations.map((hospital) => (
                      <option
                        key={hospital.id}
                        value={hospital.id}
                      >
                        {hospital.hospitalName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="register-button"
                disabled={saving}
              >
                {saving ? 'Requesting…' : 'Request transfer'}
              </button>
            </section>
          </form>
        )}

        <section className="form-section">
          <h2>Filters</h2>

          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="transfer-filter-status">
                Status
              </label>
              <select
                id="transfer-filter-status"
                value={filters.status ?? ''}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status:
                      (event.target
                        .value as TransferStatusValue) ||
                      undefined,
                  }))
                }
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {TRANSFER_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="transfer-filter-direction">
                Direction
              </label>
              <select
                id="transfer-filter-direction"
                value={filters.direction ?? 'all'}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    direction: event.target
                      .value as TransferFilters['direction'],
                  }))
                }
              >
                <option value="all">All transfers</option>
                <option value="outgoing">Outgoing</option>
                <option value="incoming">Incoming</option>
              </select>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Transfers</h2>

          {loading && <p role="status">Loading…</p>}

          {!loading && transfers.length === 0 && (
            <p>No transfers match the current filters.</p>
          )}

          {transfers.length > 0 && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th>Counterpart</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {transfers.map((transfer) => {
                    const direction = transferDirection(
                      transfer,
                      hospitalProfileId
                    )
                    const counterpart =
                      direction === 'incoming'
                        ? transfer.fromHospital.hospitalName
                        : transfer.toHospital.hospitalName

                    return (
                      <tr key={transfer.id}>
                        <td>
                          {transfer.bloodUnit.bagId}
                        </td>
                        <td>
                          {
                            BLOOD_TYPE_LABELS[
                              transfer.bloodUnit.bloodType
                            ]
                          }
                        </td>
                        <td>
                          {direction === 'incoming'
                            ? 'Incoming'
                            : 'Outgoing'}
                        </td>
                        <td>{counterpart}</td>
                        <td>
                          <span
                            className={transferStatusBadgeClass(
                              transfer.status
                            )}
                          >
                            {
                              TRANSFER_STATUS_LABELS[
                                transfer.status
                              ]
                            }
                          </span>
                        </td>
                        <td>{formatDate(transfer.updatedAt)}</td>
                        <td className="table-actions">
                          <Link
                            to={`/hospital/transfers/${transfer.id}`}
                            className="secondary-button"
                          >
                            Details
                          </Link>
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

export default TransfersPage
