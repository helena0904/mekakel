import type { ExpiryAlert } from '../../services/inventory.service'
import { BLOOD_TYPE_LABELS, formatDate } from '../../services/donor.service'

interface ExpiryAlertsProps {
  alerts: ExpiryAlert[]
}

function ExpiryAlerts({ alerts }: ExpiryAlertsProps) {
  if (alerts.length === 0) {
    return (
      <p className="section-description">
        No units are close to expiry. Nothing needs
        attention.
      </p>
    )
  }

  return (
    <ul className="report-list">
      {alerts.map((alert) => {
        const expired = alert.status === 'EXPIRED'

        return (
          <li key={alert.id} className="report-item">
            <div>
              <strong>{alert.bagId}</strong>

              <span
                className={
                  expired
                    ? 'status-badge status-badge-rejected'
                    : 'status-badge status-badge-pending'
                }
              >
                {expired ? 'Expired' : 'Expiring soon'}
              </span>

              <p>
                {BLOOD_TYPE_LABELS[alert.bloodType]} — expires{' '}
                {formatDate(alert.expiryDate)}
                {!expired && (
                  <>
                    {' '}
                    ({alert.daysUntilExpiry}{' '}
                    {alert.daysUntilExpiry === 1
                      ? 'day'
                      : 'days'}{' '}
                    left)
                  </>
                )}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default ExpiryAlerts
