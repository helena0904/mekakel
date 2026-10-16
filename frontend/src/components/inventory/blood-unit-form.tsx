import { useState, type FormEvent } from 'react'

import {
  createUnit,
  updateUnit,
} from '../../services/inventory.service'
import type {
  BloodType,
  BloodUnit,
  BloodUnitStatusValue,
  ConfirmationStatusValue,
  ScreeningStatusValue,
} from '../../services/inventory.service'
import { BLOOD_TYPE_LABELS } from '../../services/donor.service'

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

interface BloodUnitFormProps {
  unit?: BloodUnit | null
  onSaved: (unit: BloodUnit) => void
  onCancel?: () => void
}

function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

function BloodUnitForm({
  unit,
  onSaved,
  onCancel,
}: BloodUnitFormProps) {
  const editing = Boolean(unit)

  const [bagId, setBagId] = useState(unit?.bagId ?? '')
  const [bloodType, setBloodType] = useState<BloodType>(
    unit?.bloodType ?? 'O_POSITIVE'
  )
  const [collectionDate, setCollectionDate] = useState(
    toDateInput(unit?.collectionDate)
  )
  const [expiryDate, setExpiryDate] = useState(
    toDateInput(unit?.expiryDate)
  )
  const [screeningStatus, setScreeningStatus] =
    useState<ScreeningStatusValue>(
      unit?.screeningStatus ?? 'PENDING'
    )
  const [confirmationStatus, setConfirmationStatus] =
    useState<ConfirmationStatusValue>(
      unit?.confirmationStatus ?? 'PENDING'
    )
  const [status, setStatus] = useState<BloodUnitStatusValue>(
    unit?.status ?? 'AVAILABLE'
  )
  const [storageLocation, setStorageLocation] = useState(
    unit?.storageLocation ?? ''
  )
  const [storageNotes, setStorageNotes] = useState(
    unit?.storageNotes ?? ''
  )
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

    if (!bagId.trim()) {
      setError('Please enter a bag ID.')
      return
    }

    if (!collectionDate || !expiryDate) {
      setError('Please choose collection and expiry dates.')
      return
    }

    if (expiryDate <= collectionDate) {
      setError(
        'Expiry date must be after the collection date.'
      )
      return
    }

    setSaving(true)

    try {
      const input = {
        bagId: bagId.trim(),
        bloodType,
        collectionDate,
        expiryDate,
        screeningStatus,
        confirmationStatus,
        status,
        storageLocation: storageLocation.trim() || undefined,
        storageNotes: storageNotes.trim() || undefined,
      }

      const saved = editing
        ? await updateUnit(unit!.id, input)
        : await createUnit(input)

      onSaved(saved)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save the blood unit'
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
        <h2>
          {editing ? 'Edit blood unit' : 'Add blood unit'}
        </h2>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="unit-bag-id">Bag ID</label>
            <input
              id="unit-bag-id"
              type="text"
              value={bagId}
              onChange={(event) =>
                setBagId(event.target.value)
              }
              required
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="unit-blood-type">
              Blood type
            </label>
            <select
              id="unit-blood-type"
              value={bloodType}
              onChange={(event) =>
                setBloodType(event.target.value as BloodType)
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
            <label htmlFor="unit-collection-date">
              Collection date
            </label>
            <input
              id="unit-collection-date"
              type="date"
              value={collectionDate}
              onChange={(event) =>
                setCollectionDate(event.target.value)
              }
              required
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="unit-expiry-date">
              Expiry date
            </label>
            <input
              id="unit-expiry-date"
              type="date"
              value={expiryDate}
              onChange={(event) =>
                setExpiryDate(event.target.value)
              }
              required
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="unit-screening">
              Screening status
            </label>
            <select
              id="unit-screening"
              value={screeningStatus}
              onChange={(event) =>
                setScreeningStatus(
                  event.target.value as ScreeningStatusValue
                )
              }
              disabled={saving}
            >
              <option value="PENDING">Not screened</option>
              <option value="PASSED">Screened (passed)</option>
              <option value="FAILED">Screening failed</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="unit-confirmation">
              Confirmation status
            </label>
            <select
              id="unit-confirmation"
              value={confirmationStatus}
              onChange={(event) =>
                setConfirmationStatus(
                  event.target
                    .value as ConfirmationStatusValue
                )
              }
              disabled={saving}
            >
              <option value="PENDING">Unconfirmed</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="unit-status">
              Unit status
            </label>
            <select
              id="unit-status"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as BloodUnitStatusValue
                )
              }
              disabled={saving}
            >
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
              <option value="USED">Used</option>
              <option value="DISCARDED">Discarded</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="unit-storage">
              Storage location
            </label>
            <input
              id="unit-storage"
              type="text"
              value={storageLocation}
              onChange={(event) =>
                setStorageLocation(event.target.value)
              }
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="unit-storage-notes">
            Storage notes (optional)
          </label>
          <textarea
            id="unit-storage-notes"
            value={storageNotes}
            onChange={(event) =>
              setStorageNotes(event.target.value)
            }
            rows={2}
            disabled={saving}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="register-button"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : editing
                ? 'Save changes'
                : 'Add unit'}
          </button>

          {editing && onCancel && (
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

export default BloodUnitForm
