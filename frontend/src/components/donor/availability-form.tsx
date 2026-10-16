import { useState, type FormEvent } from 'react'
import type {
  AvailabilityStatus,
  DonorProfile,
  UpdateAvailabilityInput,
  Weekday,
} from '../../services/donor.service'
import { updateAvailability } from '../../services/donor.service'

const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
}

interface ScheduleEntry {
  enabled: boolean
  time: string
}

function buildInitialSchedule(
  profile: DonorProfile
): Record<Weekday, ScheduleEntry> {
  const schedule = {} as Record<Weekday, ScheduleEntry>

  for (const day of WEEKDAYS) {
    schedule[day] = { enabled: false, time: '' }
  }

  for (const availability of profile.availabilities) {
    schedule[availability.day] = {
      enabled: true,
      time: availability.time,
    }
  }

  return schedule
}

interface AvailabilityFormProps {
  profile: DonorProfile
  onSaved: (profile: DonorProfile) => void
}

function AvailabilityForm({
  profile,
  onSaved,
}: AvailabilityFormProps) {
  const [currentAvailability, setCurrentAvailability] =
    useState<AvailabilityStatus>(
      profile.currentAvailability
    )

  const [schedule, setSchedule] = useState(
    buildInitialSchedule(profile)
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function toggleDay(day: Weekday) {
    setSchedule((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        enabled: !previous[day].enabled,
      },
    }))
  }

  function setTime(day: Weekday, time: string) {
    setSchedule((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        time,
      },
    }))
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setError('')
    setSuccess('')

    const availabilities: UpdateAvailabilityInput['availabilities'] =
      []

    for (const day of WEEKDAYS) {
      const entry = schedule[day]

      if (!entry.enabled) {
        continue
      }

      if (!entry.time) {
        setError(
          `Please choose a time for ${WEEKDAY_LABELS[day]}.`
        )
        return
      }

      availabilities.push({ day, time: entry.time })
    }

    setSaving(true)

    try {
      const updated = await updateAvailability({
        currentAvailability,
        availabilities,
      })

      onSaved(updated)
      setSuccess('Availability updated successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update availability'
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
        <h2>Donation availability</h2>

        <p className="section-description">
          Availability is your own preference and is kept
          separate from medical approval. Being available does
          not mean you are medically eligible.
        </p>

        <div className="form-group">
          <label htmlFor="donor-current-availability">
            Current status
          </label>
          <select
            id="donor-current-availability"
            value={currentAvailability}
            onChange={(event) =>
              setCurrentAvailability(
                event.target.value as AvailabilityStatus
              )
            }
            disabled={saving}
          >
            <option value="AVAILABLE">
              Available to donate
            </option>
            <option value="UNAVAILABLE">
              Unavailable to donate
            </option>
          </select>
        </div>
      </section>

      <section className="form-section">
        <h2>Preferred days and times</h2>

        <p className="section-description">
          Choose the days and times that usually work for
          you.
        </p>

        <div className="availability-list">
          {WEEKDAYS.map((day) => (
            <div className="availability-row" key={day}>
              <input
                type="checkbox"
                id={`donor-day-${day}`}
                checked={schedule[day].enabled}
                onChange={() => toggleDay(day)}
                disabled={saving}
              />
              <label htmlFor={`donor-day-${day}`}>
                {WEEKDAY_LABELS[day]}
              </label>
              <input
                type="time"
                value={schedule[day].time}
                onChange={(event) =>
                  setTime(day, event.target.value)
                }
                disabled={saving || !schedule[day].enabled}
              />
            </div>
          ))}
        </div>
      </section>

      <button
        type="submit"
        className="register-button"
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save availability'}
      </button>
    </form>
  )
}

export default AvailabilityForm
