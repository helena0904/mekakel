import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'

import BloodUnitForm from '../../components/inventory/blood-unit-form'
import BloodUnitTable from '../../components/inventory/blood-unit-table'
import ExpiryAlerts from '../../components/inventory/expiry-alerts'
import {
  deleteUnit,
  getExpiryAlerts,
  getSummary,
  getUnits,
} from '../../services/inventory.service'
import type {
  BloodType,
  BloodUnit,
  ExpiryAlert,
  InventorySummary,
} from '../../services/inventory.service'
import {
  canWriteInventory,
  getHospitalProfile,
} from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'
import { BLOOD_TYPE_LABELS } from '../../services/donor.service'

const BLOOD_TYPE_OPTIONS = Object.keys(
  BLOOD_TYPE_LABELS
) as BloodType[]

interface Filters {
  search: string
  bloodType: BloodType | ''
  availability: 'available' | 'all'
}

function BloodInventoryPage() {
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [units, setUnits] = useState<BloodUnit[]>([])
  const [summary, setSummary] =
    useState<InventorySummary | null>(null)
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [filters, setFilters] = useState<Filters>({
    search: '',
    bloodType: '',
    availability: 'available',
  })
  const [searchInput, setSearchInput] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BloodUnit | null>(
    null
  )

  const canWrite = canWriteInventory(role)

  async function reload() {
    const [loadedUnits, loadedSummary, loadedAlerts] =
      await Promise.all([
        getUnits({
          search: filters.search || undefined,
          bloodType: filters.bloodType || undefined,
          availability: filters.availability,
        }),
        getSummary(),
        getExpiryAlerts(7),
      ])

    setUnits(loadedUnits)
    setSummary(loadedSummary)
    setAlerts(loadedAlerts)
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const profile = await getHospitalProfile()

        if (!cancelled) {
          setRole(profile.role)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the hospital inventory'
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const [loadedUnits, loadedSummary, loadedAlerts] =
          await Promise.all([
            getUnits({
              search: filters.search || undefined,
              bloodType: filters.bloodType || undefined,
              availability: filters.availability,
            }),
            getSummary(),
            getExpiryAlerts(7),
          ])

        if (cancelled) {
          return
        }

        setUnits(loadedUnits)
        setSummary(loadedSummary)
        setAlerts(loadedAlerts)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the blood inventory'
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
  }, [filters])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setFilters((previous) => ({
      ...previous,
      search: searchInput.trim(),
    }))
  }

  function handleSaved(unit: BloodUnit) {
    setSuccess(
      editing
        ? `Unit ${unit.bagId} updated.`
        : `Unit ${unit.bagId} added.`
    )
    setShowForm(false)
    setEditing(null)
    void reload()
  }

  async function handleDelete(unit: BloodUnit) {
    if (
      !window.confirm(`Delete blood unit ${unit.bagId}?`)
    ) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await deleteUnit(unit.id)
      setSuccess(`Unit ${unit.bagId} deleted.`)
      void reload()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete the blood unit'
      )
    }
  }

  function handleEdit(unit: BloodUnit) {
    setEditing(unit)
    setShowForm(true)
    setSuccess('')
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

        <h1>Blood Inventory</h1>

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

        {summary && (
          <section className="form-section">
            <h2>Stock summary</h2>

            <p className="section-description">
              Only screened, confirmed and unexpired units
              count as available stock.
            </p>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Available</th>
                    <th>Expired</th>
                    <th>Pending screening</th>
                    <th>Pending confirmation</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.types.map((type) => (
                    <tr key={type.bloodType}>
                      <td>
                        {BLOOD_TYPE_LABELS[type.bloodType]}
                      </td>
                      <td>{type.totalUnits}</td>
                      <td>{type.availableUnits}</td>
                      <td>{type.expiredUnits}</td>
                      <td>{type.pendingScreening}</td>
                      <td>{type.pendingConfirmation}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td>All types</td>
                    <td>{summary.totals.totalUnits}</td>
                    <td>{summary.totals.availableUnits}</td>
                    <td>{summary.totals.expiredUnits}</td>
                    <td>
                      {summary.totals.pendingScreening}
                    </td>
                    <td>
                      {summary.totals.pendingConfirmation}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        <section className="form-section">
          <h2>Expiry alerts</h2>

          <p className="section-description">
            Units expiring within the next 7 days, or already
            expired.
          </p>

          <ExpiryAlerts alerts={alerts} />
        </section>

        {canWrite && (
          <section className="form-section">
            <div className="section-header">
              <h2>
                {editing
                  ? 'Edit blood unit'
                  : 'Inventory units'}
              </h2>

              {!showForm && (
                <button
                  type="button"
                  className="register-button"
                  onClick={() => {
                    setEditing(null)
                    setShowForm(true)
                  }}
                >
                  Add unit
                </button>
              )}
            </div>

            {showForm && (
              <BloodUnitForm
                unit={editing}
                onSaved={handleSaved}
                onCancel={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
              />
            )}
          </section>
        )}

        <section className="form-section">
          <h2>Search inventory</h2>

          <form
            className="filter-bar"
            onSubmit={handleSearch}
          >
            <div className="form-group">
              <label htmlFor="inventory-search">
                Bag ID
              </label>
              <input
                id="inventory-search"
                type="search"
                value={searchInput}
                placeholder="Search by bag ID"
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="inventory-blood-type">
                Blood type
              </label>
              <select
                id="inventory-blood-type"
                value={filters.bloodType}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    bloodType: event.target
                      .value as BloodType | '',
                  }))
                }
              >
                <option value="">All types</option>
                {BLOOD_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {BLOOD_TYPE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="inventory-availability">
                Availability
              </label>
              <select
                id="inventory-availability"
                value={filters.availability}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    availability: event.target
                      .value as 'available' | 'all',
                  }))
                }
              >
                <option value="available">
                  Available only
                </option>
                <option value="all">All units</option>
              </select>
            </div>

            <button
              type="submit"
              className="register-button"
            >
              Search
            </button>
          </form>
        </section>

        <section className="form-section">
          <h2>Units</h2>

          {loading && <p role="status">Loading…</p>}

          {!loading && units.length === 0 && (
            <p>No blood units match the current filters.</p>
          )}

          {units.length > 0 && (
            <BloodUnitTable
              units={units}
              canWrite={canWrite}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </section>
      </div>
    </main>
  )
}

export default BloodInventoryPage
