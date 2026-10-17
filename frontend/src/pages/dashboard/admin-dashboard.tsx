import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import {
  getGovernanceSettings,
  updateGovernanceSettings,
} from '../../services/admin.service'
import type { GovernanceSettings } from '../../services/admin.service'

function AdminDashboard() {
  const { user } = useAuth()

  const [settings, setSettings] =
    useState<GovernanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getGovernanceSettings()

        if (!cancelled) {
          setSettings(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load platform settings'
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

  async function handleSaveSettings() {
    if (!settings || saving) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await updateGovernanceSettings({
        eligibility: settings.eligibility,
        compatibility: settings.compatibility,
      })

      setSettings(updated)
      setSuccess('Governance settings saved.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save governance settings'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <h1>Administrator Dashboard</h1>

        <p>Welcome, {user?.name}!</p>

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

        <section className="dashboard-card">
          <h2>Platform administration</h2>

          <ul className="donor-links">
            <li>
              <Link to="/admin/hospitals">
                Review hospital registrations
              </Link>
            </li>
            <li>
              <Link to="/admin/users">
                Manage users, roles and access
              </Link>
            </li>
            <li>
              <Link to="/admin/audit-logs">
                Review the audit trail
              </Link>
            </li>
          </ul>
        </section>

        <section className="form-section">
          <h2>Governance settings</h2>

          <p>
            These rules shape donation screening and
            preliminary compatibility across the platform.
            Every change is recorded in the audit trail.
          </p>

          {loading && <p role="status">Loading settings…</p>}

          {settings && (
            <>
              <h3>Donation eligibility</h3>

              <div className="filter-bar">
                <div className="form-group">
                  <label htmlFor="min-age">
                    Minimum age
                  </label>
                  <input
                    id="min-age"
                    type="number"
                    min={0}
                    max={120}
                    value={settings.eligibility.minAge}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        eligibility: {
                          ...settings.eligibility,
                          minAge: Number(event.target.value),
                        },
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="max-age">
                    Maximum age
                  </label>
                  <input
                    id="max-age"
                    type="number"
                    min={0}
                    max={120}
                    value={settings.eligibility.maxAge}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        eligibility: {
                          ...settings.eligibility,
                          maxAge: Number(event.target.value),
                        },
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="min-weight">
                    Minimum weight (kg)
                  </label>
                  <input
                    id="min-weight"
                    type="number"
                    min={1}
                    max={300}
                    value={settings.eligibility.minWeightKg}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        eligibility: {
                          ...settings.eligibility,
                          minWeightKg: Number(
                            event.target.value
                          ),
                        },
                      })
                    }
                  />
                </div>
              </div>

              <h3>Compatibility policy</h3>

              <ul className="notification-preference-list">
                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        settings.compatibility.enforceRh
                      }
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          compatibility: {
                            ...settings.compatibility,
                            enforceRh: event.target.checked,
                          },
                        })
                      }
                    />
                    <span>
                      <strong>Enforce Rh matching</strong>
                      <br />
                      <small>
                        Require Rh-negative red cells for
                        Rh-negative recipients.
                      </small>
                    </span>
                  </label>
                </li>

                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        settings.compatibility.plasmaReversed
                      }
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          compatibility: {
                            ...settings.compatibility,
                            plasmaReversed:
                              event.target.checked,
                          },
                        })
                      }
                    />
                    <span>
                      <strong>
                        Reversed plasma ABO direction
                      </strong>
                      <br />
                      <small>
                        Use the plasma-specific ABO rule for
                        plasma requests.
                      </small>
                    </span>
                  </label>
                </li>
              </ul>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveSettings}
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default AdminDashboard
