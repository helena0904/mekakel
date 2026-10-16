import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  addDonationRecord,
  formatDate,
  getHistory,
} from '../../services/donor.service'
import type { DonationRecord } from '../../services/donor.service'

function DonorHistoryPage() {
  const [history, setHistory] = useState<DonationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [donatedAt, setDonatedAt] = useState('')
  const [facilityName, setFacilityName] = useState('')
  const [units, setUnits] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function refresh() {
    setHistory(await getHistory())
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getHistory()

        if (!cancelled) {
          setHistory(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your donation history'
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setError('')
    setSuccess('')

    if (!donatedAt) {
      setError('Please choose the donation date.')
      return
    }

    setSaving(true)

    try {
      await addDonationRecord({
        donatedAt,
        facilityName: facilityName.trim() || undefined,
        units: units.trim() ? Number(units) : undefined,
        notes: notes.trim() || undefined,
      })

      setSuccess('Donation recorded.')
      setDonatedAt('')
      setFacilityName('')
      setUnits('')
      setNotes('')

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to record the donation'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/donor-dashboard"
          className="back-link"
        >
          ← Back to dashboard
        </Link>

        <h1>Donation History</h1>

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

        <form
          className="register-form"
          onSubmit={handleSubmit}
        >
          <section className="form-section">
            <h2>Record a donation</h2>

            <div className="form-group">
              <label htmlFor="donation-date">
                Donation date
              </label>
              <input
                id="donation-date"
                type="date"
                value={donatedAt}
                onChange={(event) =>
                  setDonatedAt(event.target.value)
                }
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="donation-facility">
                Facility (optional)
              </label>
              <input
                id="donation-facility"
                type="text"
                value={facilityName}
                onChange={(event) =>
                  setFacilityName(event.target.value)
                }
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="donation-units">
                Units (optional)
              </label>
              <input
                id="donation-units"
                type="number"
                min="0.5"
                step="0.5"
                value={units}
                onChange={(event) =>
                  setUnits(event.target.value)
                }
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="donation-notes">
                Notes (optional)
              </label>
              <textarea
                id="donation-notes"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                rows={3}
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              className="register-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Add donation'}
            </button>
          </section>
        </form>

        <section className="form-section">
          <h2>Past donations</h2>

          {loading && <p role="status">Loading…</p>}

          {!loading && history.length === 0 && (
            <p>No donations recorded yet.</p>
          )}

          {history.length > 0 && (
            <ul className="history-list">
              {history.map((record) => (
                <li key={record.id} className="history-item">
                  <strong>{formatDate(record.donatedAt)}</strong>

                  <span>
                    {record.facilityName || 'Facility not specified'}
                  </span>

                  {record.units !== null && (
                    <span>{record.units} units</span>
                  )}

                  {record.notes && (
                    <p className="verification-notes">
                      {record.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

export default DonorHistoryPage
