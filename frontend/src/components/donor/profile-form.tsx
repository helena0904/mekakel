import { useState, type FormEvent } from 'react'
import type {
  BloodType,
  DonorProfile,
  UpdateProfileInput,
} from '../../services/donor.service'
import {
  BLOOD_TYPE_LABELS,
  updateProfile,
} from '../../services/donor.service'

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

interface ProfileFormProps {
  profile: DonorProfile
  onSaved: (profile: DonorProfile) => void
}

function ProfileForm({
  profile,
  onSaved,
}: ProfileFormProps) {
  const [phone, setPhone] = useState(profile.phone)
  const [additionalPhone, setAdditionalPhone] = useState(
    profile.additionalPhone ?? ''
  )
  const [subcity, setSubcity] = useState(profile.subcity ?? '')
  const [wereda, setWereda] = useState(profile.wereda ?? '')
  const [bloodType, setBloodType] = useState<BloodType | ''>(
    profile.bloodType ?? ''
  )
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.dateOfBirth
      ? profile.dateOfBirth.slice(0, 10)
      : ''
  )
  const [lastDonation, setLastDonation] = useState(
    profile.lastDonation ? profile.lastDonation.slice(0, 10) : ''
  )
  const [weight, setWeight] = useState(String(profile.weight))
  const [height, setHeight] = useState(String(profile.height))
  const [donationIntervalDays, setDonationIntervalDays] =
    useState(String(profile.donationIntervalDays))
  const [consentToContact, setConsentToContact] = useState(
    profile.consentToContact
  )
  const [shareLocation, setShareLocation] = useState(
    profile.shareLocation
  )
  const [matchingOptOut, setMatchingOptOut] = useState(
    profile.matchingOptOut
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      const input: UpdateProfileInput = {
        phone: phone.trim(),
        address: `${wereda.trim()}, ${subcity.trim()}`,
        subcity: subcity.trim(),
        wereda: wereda.trim(),
        weight: Number(weight),
        height: Number(height),
        bloodType: bloodType === '' ? null : bloodType,
        consentToContact,
        shareLocation,
        matchingOptOut,
      }

      const trimmedAdditional = additionalPhone.trim()

      if (trimmedAdditional) {
        input.additionalPhone = trimmedAdditional
      }

      if (dateOfBirth) {
        input.dateOfBirth = dateOfBirth
      }

      if (lastDonation) {
        input.lastDonation = lastDonation
      }

      if (donationIntervalDays.trim()) {
        input.donationIntervalDays = Number(
          donationIntervalDays
        )
      }

      const updated = await updateProfile(input)
      onSaved(updated)
      setSuccess('Profile updated successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update profile'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="register-form"
      onSubmit={handleSubmit}
    >
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
        <h2>Personal information</h2>

        <div className="form-group">
          <label htmlFor="donor-phone">
            Phone number
          </label>
          <input
            id="donor-phone"
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
          <label htmlFor="donor-additional-phone">
            Additional phone (optional)
          </label>
          <input
            id="donor-additional-phone"
            type="tel"
            value={additionalPhone}
            onChange={(event) =>
              setAdditionalPhone(event.target.value)
            }
            disabled={saving}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="donor-subcity">Subcity</label>
            <input
              id="donor-subcity"
              type="text"
              value={subcity}
              onChange={(event) =>
                setSubcity(event.target.value)
              }
              required
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="donor-wereda">Wereda</label>
            <input
              id="donor-wereda"
              type="text"
              value={wereda}
              onChange={(event) =>
                setWereda(event.target.value)
              }
              required
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="donor-dob">
            Date of birth
          </label>
          <input
            id="donor-dob"
            type="date"
            value={dateOfBirth}
            onChange={(event) =>
              setDateOfBirth(event.target.value)
            }
            disabled={saving}
          />
        </div>
      </section>

      <section className="form-section">
        <h2>Blood and body information</h2>

        <div className="form-group">
          <label htmlFor="donor-blood-type">
            Blood type
          </label>
          <select
            id="donor-blood-type"
            value={bloodType}
            onChange={(event) =>
              setBloodType(
                event.target.value as BloodType | ''
              )
            }
            disabled={saving}
          >
            <option value="">Prefer not to say</option>
            {BLOOD_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {BLOOD_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="donor-weight">
            Weight (kg)
          </label>
          <input
            id="donor-weight"
            type="number"
            min="1"
            step="0.1"
            value={weight}
            onChange={(event) =>
              setWeight(event.target.value)
            }
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-height">
            Height (cm)
          </label>
          <input
            id="donor-height"
            type="number"
            min="1"
            step="0.1"
            value={height}
            onChange={(event) =>
              setHeight(event.target.value)
            }
            required
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="donor-interval">
            Minimum days between donations
          </label>
          <input
            id="donor-interval"
            type="number"
            min="1"
            max="365"
            value={donationIntervalDays}
            onChange={(event) =>
              setDonationIntervalDays(event.target.value)
            }
            disabled={saving}
          />
          <small>
            Used only for preliminary guidance. A healthcare
            professional decides final eligibility.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="donor-last-donation">
            Last donation date
          </label>
          <input
            id="donor-last-donation"
            type="date"
            value={lastDonation}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) =>
              setLastDonation(event.target.value)
            }
            disabled={saving}
          />
          <small>
            Leave empty if you have never donated. Updating your
            last donation date does not require re-verification.
          </small>
        </div>

        <p className="section-description">
          Changing your weight requires your medical report to be
          verified again.
        </p>
      </section>

      <section className="form-section">
        <h2>Consent and privacy</h2>

        <label className="warning-checkbox consent-checkbox">
          <input
            type="checkbox"
            checked={consentToContact}
            onChange={(event) =>
              setConsentToContact(event.target.checked)
            }
            disabled={saving}
          />
          <span>
            I allow Mekakel and verified care facilities to
            contact me about donation opportunities.
          </span>
        </label>

        <label className="warning-checkbox consent-checkbox">
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(event) =>
              setShareLocation(event.target.checked)
            }
            disabled={saving}
          />
          <span>
            I allow my approximate location to be used when
            matching nearby requests.
          </span>
        </label>

        <label className="warning-checkbox consent-checkbox">
          <input
            type="checkbox"
            checked={matchingOptOut}
            onChange={(event) =>
              setMatchingOptOut(event.target.checked)
            }
            disabled={saving}
          />
          <span>
            Do not include me in donor matching. I can still
            update my profile and availability.
          </span>
        </label>
      </section>

      <button
        type="submit"
        className="register-button"
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  )
}

export default ProfileForm
