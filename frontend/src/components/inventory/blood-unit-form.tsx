import { useState, type FormEvent } from 'react'

import {
  createUnit,
  updateUnit,
} from '../../services/inventory.service'
import type {
  BloodComponent,
  BloodType,
  BloodUnit,
} from '../../services/inventory.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import { BLOOD_TYPE_LABELS } from '../../services/donor.service'

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

const BLOOD_COMPONENT_OPTIONS = Object.keys(
  BLOOD_COMPONENT_LABELS
) as BloodComponent[]

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

  const [quantity, setQuantity] = useState('1')
  const [bloodType, setBloodType] = useState<BloodType>(
    unit?.bloodType ?? 'O_POSITIVE'
  )
  const [component, setComponent] = useState<BloodComponent>(
    unit?.component ?? 'RED_CELLS'
  )
  const [collectionDate, setCollectionDate] = useState(
    toDateInput(unit?.collectionDate)
  )
  const [expiryDate, setExpiryDate] = useState(
    toDateInput(unit?.expiryDate)
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
        bloodType,
        component,
        collectionDate,
        expiryDate,
        ...(editing
          ? {}
          : {
              quantity: Math.max(
                1,
                Math.min(500, Number(quantity) || 1)
              ),
            }),
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

        <p className="section-description">
          Blood ID: {unit?.bagId ?? 'Generated automatically when saved'}
        </p>

        <div className="form-row">
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

          <div className="form-group">
            <label htmlFor="unit-component">
              Component
            </label>
            <select
              id="unit-component"
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
        </div>

        {!editing && (
          <div className="form-group">
            <label htmlFor="unit-quantity">
              Units to share (quantity)
            </label>
            <input
              id="unit-quantity"
              type="number"
              min="1"
              max="500"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              disabled={saving}
            />
            <small>
              Add the number of compatible units available to
              share. Multiple units receive numbered bag IDs.
            </small>
          </div>
        )}

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

        <p className="section-description">
          Added units are recorded as screened negative and
          confirmed, ready to be shared with approved
          hospitals.
        </p>

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
