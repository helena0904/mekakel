import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { dashboardPathFor } from '../../utils/dashboard'
import { formatDate } from '../../services/donor.service'
import {
  getNotificationPreferences,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_PREFERENCE_LABELS,
  NOTIFICATION_STATUS_LABELS,
  notificationStatusBadgeClass,
  updateNotificationPreferences,
} from '../../services/notification.service'
import type {
  Notification,
  NotificationCategoryValue,
  NotificationFilters,
  NotificationPreferences,
  NotificationStatusValue,
} from '../../services/notification.service'

const CATEGORY_OPTIONS = Object.keys(
  NOTIFICATION_CATEGORY_LABELS
) as NotificationCategoryValue[]

const STATUS_OPTIONS = Object.keys(
  NOTIFICATION_STATUS_LABELS
) as NotificationStatusValue[]

function NotificationsPage() {
  const { user } = useAuth()

  const [notifications, setNotifications] = useState<
    Notification[]
  >([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null)

  const [filters, setFilters] = useState<{
    category: NotificationCategoryValue | ''
    status: NotificationStatusValue | ''
    unreadOnly: boolean
  }>({
    category: '',
    status: '',
    unreadOnly: false,
  })

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [savingPreference, setSavingPreference] = useState<
    keyof NotificationPreferences | null
  >(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const backPath = user
    ? dashboardPathFor(user.accountType)
    : '/'

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError('')

      const query: NotificationFilters = {}

      if (filters.category) {
        query.category = filters.category
      }

      if (filters.status) {
        query.status = filters.status
      }

      if (filters.unreadOnly) {
        query.unreadOnly = true
      }

      try {
        const [loaded, loadedPreferences] = await Promise.all(
          [
            getNotifications(query),
            getNotificationPreferences(),
          ]
        )

        if (cancelled) {
          return
        }

        setNotifications(loaded.notifications)
        setUnreadCount(loaded.unreadCount)
        setPreferences(loadedPreferences)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load notifications'
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

  async function handleMarkRead(notification: Notification) {
    if (notification.readAt || busy) {
      return
    }

    setBusy(true)
    setError('')

    try {
      const updated = await markNotificationRead(
        notification.id
      )

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the notification'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkAllRead() {
    if (busy || unreadCount === 0) {
      return
    }

    setBusy(true)
    setError('')

    try {
      await markAllNotificationsRead()
      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        }))
      )
      setUnreadCount(0)
      setSuccess('All notifications marked as read.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update notifications'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleTogglePreference(
    key: keyof NotificationPreferences
  ) {
    if (!preferences || savingPreference) {
      return
    }

    const nextValue = !preferences[key]

    setSavingPreference(key)
    setError('')
    setSuccess('')

    try {
      const updated = await updateNotificationPreferences({
        [key]: nextValue,
      })

      setPreferences(updated)
      setSuccess('Notification preferences updated.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update notification preferences'
      )
    } finally {
      setSavingPreference(null)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to={backPath} className="back-link">
          ← Back to dashboard
        </Link>

        <h1>Notifications</h1>

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
          <h2>Email preferences</h2>

          <p>
            Choose which MEKAKEL updates you receive by
            email. Urgent donor communication always
            stays by telephone per hospital policy.
          </p>

          {preferences && (
            <ul className="notification-preference-list">
              {NOTIFICATION_PREFERENCE_LABELS.map((entry) => (
                <li key={entry.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences[entry.key]}
                      disabled={
                        savingPreference !== null &&
                        savingPreference !== entry.key
                      }
                      onChange={() =>
                        handleTogglePreference(entry.key)
                      }
                    />
                    <span>
                      <strong>{entry.label}</strong>
                      <br />
                      <small>{entry.description}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-section">
          <h2>Filter</h2>

          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="notification-category">
                Category
              </label>
              <select
                id="notification-category"
                value={filters.category}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    category: event.target
                      .value as NotificationCategoryValue | '',
                  }))
                }
              >
                <option value="">All categories</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {NOTIFICATION_CATEGORY_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notification-status">
                Status
              </label>
              <select
                id="notification-status"
                value={filters.status}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status: event.target
                      .value as NotificationStatusValue | '',
                  }))
                }
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {NOTIFICATION_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notification-unread">
                <input
                  id="notification-unread"
                  type="checkbox"
                  checked={filters.unreadOnly}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      unreadOnly: event.target.checked,
                    }))
                  }
                />{' '}
                Unread only
              </label>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>
              Inbox
              {unreadCount > 0 && (
                <span className="status-badge status-badge-info">
                  {unreadCount} unread
                </span>
              )}
            </h2>

            <button
              type="button"
              className="secondary-button"
              disabled={busy || unreadCount === 0}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </button>
          </div>

          {loading && <p role="status">Loading…</p>}

          {!loading && notifications.length === 0 && (
            <p>No notifications match the current filters.</p>
          )}

          {notifications.length > 0 && (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={
                    notification.readAt
                      ? 'notification-item'
                      : 'notification-item notification-unread'
                  }
                >
                  <div className="notification-item-header">
                    <strong>
                      {notification.subject}
                    </strong>

                    <span
                      className={notificationStatusBadgeClass(
                        notification.status
                      )}
                    >
                      {
                        NOTIFICATION_STATUS_LABELS[
                          notification.status
                        ]
                      }
                    </span>
                  </div>

                  <p className="notification-body">
                    {notification.body}
                  </p>

                  <div className="notification-item-footer">
                    <span>
                      {
                        NOTIFICATION_CATEGORY_LABELS[
                          notification.category
                        ]
                      }{' '}
                      · {formatDate(notification.createdAt)}
                    </span>

                    {!notification.readAt && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() =>
                          handleMarkRead(notification)
                        }
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

export default NotificationsPage
