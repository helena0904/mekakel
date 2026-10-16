import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import AvailabilityForm from '../../components/donor/availability-form'
import { getProfile } from '../../services/donor.service'
import type { DonorProfile } from '../../services/donor.service'

function DonorAvailabilityPage() {
  const [profile, setProfile] = useState<DonorProfile | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getProfile()

        if (!cancelled) {
          setProfile(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your availability'
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

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/donor-dashboard"
          className="back-link"
        >
          ← Back to dashboard
        </Link>

        <h1>Donation Availability</h1>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {loading && <p role="status">Loading…</p>}

        {profile && (
          <AvailabilityForm
            profile={profile}
            onSaved={setProfile}
          />
        )}
      </div>
    </main>
  )
}

export default DonorAvailabilityPage
