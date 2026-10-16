import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'

import {
  canManageHospital,
  getHospitalProfile,
  HOSPITAL_STATUS_LABELS,
  hospitalStatusBadgeClass,
  updateHospitalProfile,
} from '../../services/hospital.service'
import type {
  HospitalProfile,
  HospitalStaffRoleValue,
} from '../../services/hospital.service'

function HospitalProfilePage() {
  const [profile, setProfile] =
    useState<HospitalProfile | null>(null)
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [hospitalName, setHospitalName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [additionalPhone, setAdditionalPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getHospitalProfile()

        if (cancelled) {
          return
        }

        setProfile(loaded.profile)
        setRole(loaded.role)
        setHospitalName(loaded.profile.hospitalName)
        setAddress(loaded.profile.address)
        setPhone(loaded.profile.phone)
        setAdditionalPhone(
          loaded.profile.additionalPhone ?? ''
        )
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the hospital profile'
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

  const canManage = canManageHospital(role)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const updated = await updateHospitalProfile({
        hospitalName: hospitalName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        additionalPhone:
          additionalPhone.trim() || undefined,
      })

      setProfile(updated)
      setSuccess('Hospital profile updated.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the hospital profile'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-container">
          <p role="status">Loading hospital profile…</p>
        </div>
      </main>
    )
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

        <h1>Hospital Profile</h1>

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

        {profile && (
          <>
            <section className="verification-status">
              <div className="verification-status-header">
                <h2>Registration status</h2>

                <span
                  className={hospitalStatusBadgeClass(
                    profile.status
                  )}
                >
                  {HOSPITAL_STATUS_LABELS[profile.status]}
                </span>
              </div>

              {profile.reviewNotes && (
                <p className="verification-notes">
                  Reviewer note: {profile.reviewNotes}
                </p>
              )}

              {profile.status === 'PENDING' && (
                <p>
                  Your institution is awaiting administrator
                  approval. Inventory and staff management
                  become available once approved.
                </p>
              )}
            </section>

            <section className="dashboard-card">
              <h2>Contact details</h2>

              <p>Signed in as: {profile.user?.email}</p>
              <p>Your role: {role}</p>
            </section>

            {canManage ? (
              <form
                className="register-form"
                onSubmit={handleSubmit}
              >
                <section className="form-section">
                  <h2>Institution information</h2>

                  <div className="form-group">
                    <label htmlFor="hospital-name">
                      Hospital name
                    </label>
                    <input
                      id="hospital-name"
                      type="text"
                      value={hospitalName}
                      onChange={(event) =>
                        setHospitalName(event.target.value)
                      }
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="hospital-address">
                      Address
                    </label>
                    <input
                      id="hospital-address"
                      type="text"
                      value={address}
                      onChange={(event) =>
                        setAddress(event.target.value)
                      }
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="hospital-phone">
                      Phone number
                    </label>
                    <input
                      id="hospital-phone"
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="hospital-additional-phone">
                      Additional phone (optional)
                    </label>
                    <input
                      id="hospital-additional-phone"
                      type="tel"
                      value={additionalPhone}
                      onChange={(event) =>
                        setAdditionalPhone(
                          event.target.value
                        )
                      }
                      disabled={saving}
                    />
                  </div>

                  <button
                    type="submit"
                    className="register-button"
                    disabled={saving}
                  >
                    {saving
                      ? 'Saving...'
                      : 'Save profile'}
                  </button>
                </section>
              </form>
            ) : (
              <section className="dashboard-card">
                <h2>Institution information</h2>

                <p>Name: {profile.hospitalName}</p>
                <p>Address: {profile.address}</p>
                <p>Phone: {profile.phone}</p>
                <p>
                  Additional phone:{' '}
                  {profile.additionalPhone || '—'}
                </p>

                <p className="section-description">
                  Only hospital owners and administrators can
                  edit these details.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default HospitalProfilePage
