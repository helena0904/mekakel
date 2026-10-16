import type { BloodUnit } from '../../services/inventory.service'
import {
  BLOOD_UNIT_STATUS_LABELS,
  CONFIRMATION_STATUS_LABELS,
  SCREENING_STATUS_LABELS,
} from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'

interface BloodUnitTableProps {
  units: BloodUnit[]
  canWrite: boolean
  onEdit: (unit: BloodUnit) => void
  onDelete: (unit: BloodUnit) => void
}

function availabilityMeta(unit: BloodUnit): {
  label: string
  className: string
} {
  if (unit.isExpired) {
    return {
      label: 'Expired',
      className: 'status-badge status-badge-rejected',
    }
  }

  if (unit.isAvailable) {
    return {
      label: 'Available',
      className: 'status-badge status-badge-approved',
    }
  }

  return {
    label: 'Not available',
    className: 'status-badge status-badge-pending',
  }
}

function BloodUnitTable({
  units,
  canWrite,
  onEdit,
  onDelete,
}: BloodUnitTableProps) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Bag ID</th>
            <th>Type</th>
            <th>Collected</th>
            <th>Expires</th>
            <th>Screening</th>
            <th>Confirmation</th>
            <th>Storage</th>
            <th>Availability</th>
            {canWrite && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {units.map((unit) => {
            const availability = availabilityMeta(unit)

            return (
              <tr key={unit.id}>
                <td>{unit.bagId}</td>

                <td>{BLOOD_TYPE_LABELS[unit.bloodType]}</td>

                <td>{formatDate(unit.collectionDate)}</td>

                <td>
                  {formatDate(unit.expiryDate)}
                  {!unit.isExpired && (
                    <span className="cell-note">
                      {' '}
                      ({unit.daysUntilExpiry}d)
                    </span>
                  )}
                </td>

                <td>
                  {SCREENING_STATUS_LABELS[unit.screeningStatus]}
                </td>

                <td>
                  {
                    CONFIRMATION_STATUS_LABELS[
                      unit.confirmationStatus
                    ]
                  }
                </td>

                <td>
                  {unit.storageLocation || '—'}
                  <span className="cell-note">
                    {BLOOD_UNIT_STATUS_LABELS[unit.status]}
                  </span>
                </td>

                <td>
                  <span className={availability.className}>
                    {availability.label}
                  </span>
                </td>

                {canWrite && (
                  <td className="table-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onEdit(unit)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="secondary-button danger-button"
                      onClick={() => onDelete(unit)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default BloodUnitTable
