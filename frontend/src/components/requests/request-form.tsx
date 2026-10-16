import { useState, type FormEvent } from 'react'

import {
  createRequest,
  REQUEST_URGENCY_LABELS,
} from '../../services/blood-request.service'
import type {
  BloodRequest,
  BloodRequestInput,
  RequestUrgencyValue,
} from '../../services/blood-request.service'
import type {
  BloodComponent,
  BloodType,
} from '../../services/inventory.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import { BLOOD_TYPE_LABELS } from '../../services/donor.service'

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

const BLOOD_COMPONENT_OPTIONS = Object.keys(
  BLOOD_COMPONENT_LABELS
) as BloodComponent[]

const URGENCY_OPTIONS = Object.keys(
  REQUEST_URGENCY_LABELS
) as RequestUrgencyValue[]

interface RequestFormProps {
  onSaved: (request: BloodRequest) => void
  onCancel?: () => void
}

function RequestForm({ onSaved, onCancel }: RequestFormProps) {
  const [component, setComponent] = useState<BloodComponent>(
    'RED_CELLS'
  )
  const [bloodType, setBloodType] = useState<BloodType>(
    'O_POSITIVE'
  )
  const [requiredUnits, setRequiredUnits] = useState('1')
  const [urgency, setUrgency] =
    useState<RequestUrgencyValue>('ROUTINE')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) {
      return
    }

    setError('')

    const units = Number(requiredUnits)

    if (
      !Number.isInteger(units) ||
      units < 1 ||
      units > 100
    ) {
      setError('Required units must be a whole number from 1 to 100.')
      return
    }

    setSaving(true)

    try {
      const input: BloodRequestInput = {
        component,
        bloodType,
        requiredUnits: units,
        urgency,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      }

      const saved = await createRequest(input)

      onSaved(saved)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create the blood request'
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

      <section className="form-section">
        <h2>New blood request</h2>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="request-component">
              Component
            </label>
            <select
              id="request-component"
              value={component}
              onChange={(event) =>
                setComponent(
                  event.target.value as BloodComponent
                )
              }
              disabled={saving}
            >
              {BLOOD_COMPONENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {BLOOD_COMPONENT_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="request-blood-type">
              Blood type
            </label>
            <select
              id="request-blood-type"
              value={bloodType}
              onChange={(event) =>
                setBloodType(
                  event.target.value as BloodType
                )
              }
              disabled={saving}
            >
              {BLOOD_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {BLOOD_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="request-units">
              Required units
            </label>
            <input
              id="request-units"
              type="number"
              min={1}
              max={100}
              value={requiredUnits}
              onChange={(event) =>
                setRequiredUnits(event.target.value)
              }
              required
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="request-urgency">
              Urgency
            </label>
            <select
              id="request-urgency"
              value={urgency}
              onChange={(event) =>
                setUrgency(
                  event.target.value as RequestUrgencyValue
                )
              }
              disabled={saving}
            >
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {REQUEST_URGENCY_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="request-location">
            Location (optional)
          </label>
          <input
            id="request-location"
            type="text"
            value={location}
            placeholder="City or facility area"
            onChange={(event) =>
              setLocation(event.target.value)
            }
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="request-notes">
            Clinical notes (optional)
          </label>
          <textarea
            id="request-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            rows={3}
            disabled={saving}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="register-button"
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create request'}
          </button>

          {onCancel && (
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </section>
    </form>
  )
}

export default RequestForm
