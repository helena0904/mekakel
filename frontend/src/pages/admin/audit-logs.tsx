import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatDate } from '../../services/donor.service'
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  listAuditLogs,
} from '../../services/admin.service'
import type {
  AuditActionValue,
  AuditLog,
} from '../../services/admin.service'

function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actionFilter, setActionFilter] = useState<
    AuditActionValue | ''
  >('')
  const [entityType, setEntityType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const loaded = await listAuditLogs({
        action: actionFilter || undefined,
        entityType: entityType.trim() || undefined,
        limit: 100,
      })

      setLogs(loaded)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load audit logs'
      )
    } finally {
      setLoading(false)
    }
  }, [actionFilter, entityType])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [load])

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/admin-dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <h1>Audit trail</h1>

        <p>
          Every material decision — medical approvals,
          hospital reviews, role changes and governance
          updates — is recorded here with the responsible
          user and timestamp.
        </p>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        <section className="form-section">
          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="audit-action">Action</label>
              <select
                id="audit-action"
                value={actionFilter}
                onChange={(event) =>
                  setActionFilter(
                    event.target.value as AuditActionValue | ''
                  )
                }
              >
                <option value="">All actions</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {AUDIT_ACTION_LABELS[action]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="audit-entity">
                Entity type
              </label>
              <input
                id="audit-entity"
                type="text"
                value={entityType}
                placeholder="e.g. DonorProfile"
                onChange={(event) =>
                  setEntityType(event.target.value)
                }
              />
            </div>
          </div>
        </section>

        {loading && <p role="status">Loading…</p>}

        {!loading && logs.length === 0 && (
          <p>No audit entries match the current filters.</p>
        )}

        {logs.length > 0 && (
          <ul className="notification-list">
            {logs.map((log) => (
              <li key={log.id} className="notification-item">
                <div className="notification-item-header">
                  <strong>
                    {AUDIT_ACTION_LABELS[log.action]}
                  </strong>

                  <span className="status-badge status-badge-info">
                    {log.entityType}
                    {log.entityId !== null
                      ? ` #${log.entityId}`
                      : ''}
                  </span>
                </div>

                <p className="notification-body">
                  {log.summary}
                </p>

                <div className="notification-item-footer">
                  <span>
                    {log.actorName ?? 'System'}
                    {log.actorRole
                      ? ` (${log.actorRole})`
                      : ''}{' '}
                    · {formatDate(log.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

export default AuditLogsPage
