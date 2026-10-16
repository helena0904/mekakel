import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ProfileForm from '../../components/donor/profile-form'
import VerificationStatus from '../../components/donor/verification-status'
import {
  getEligibility,
  getProfile,
} from '../../services/donor.service'
import type {
  DonorProfile,
  EligibilityResult,
} from '../../services/donor.service'

function DonorProfilePage() {
  const [profile, setProfile] = useState<DonorProfile | null>(
    null
  )
  const [eligibility, setEligibility] =
    useState<EligibilityResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEligibility = useCallback(async () => {
    try {
      setEligibility(await getEligibility())
    } catch {
      // Eligibility is supplementary on this page.
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getProfile()

        if (cancelled) {
          return
        }

        setProfile(loaded)
        void loadEligibility()
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your profile'
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
  }, [loadEligibility])

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-container">
          <p role="status">Loading your profile…</p>
        </div>
      </main>
    )
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

        <h1>Donor Profile</h1>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {profile && (
          <>
            <VerificationStatus
              status={profile.verificationStatus}
              notes={profile.verificationNotes}
              verifiedAt={profile.verifiedAt}
            />

            {eligibility && (
              <section className="dashboard-card">
                <h2>Preliminary eligibility</h2>

                <ul className="eligibility-list">
                  {eligibility.checks.map((check) => (
                    <li key={check.key}>
                      <span
                        className={
                          check.passed
                            ? 'check-pass'
                            : check.informational
                              ? 'check-info'
                              : 'check-fail'
                        }
                      >
                        {check.passed ? '✓' : '•'}
                      </span>
                      <span>
                        <strong>{check.label}</strong> —{' '}
                        {check.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ProfileForm
              profile={profile}
              onSaved={(updated) => {
                setProfile(updated)
                void loadEligibility()
              }}
            />
          </>
        )}
      </div>
    </main>
  )
}

export default DonorProfilePage
