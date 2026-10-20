import { useState } from 'react'
import { Link } from 'react-router-dom'

import { searchNearby } from '../../services/hospital.service'
import type { HospitalSearchResult } from '../../services/hospital.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import type { BloodComponent } from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import type { BloodType } from '../../services/donor.service'

function HospitalSearchPage() {
  const [result, setResult] =
    useState<HospitalSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    if (loading) {
      return
    }

    setError('')
    setLoading(true)

    try {
      const loaded = await searchNearby()
      setResult(loaded)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to search nearby donors and hospitals'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/hospital-dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <h1>Find nearby donors and hospitals</h1>

        <p className="section-description">
          Click search to see approved hospitals and available donors near
          your facility. Contact them directly to request compatible blood
          units, ranked by FEFO (first expired, first out) when units are
          available.
        </p>

        <button
          type="button"
          className="register-button"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {result && (
          <>
            <section className="dashboard-card">
              <h2>Nearby hospitals</h2>

              {result.hospitals.length === 0 && (
                <p>No approved hospitals found nearby.</p>
              )}

              {result.hospitals.length > 0 && (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hospital</th>
                        <th>Location</th>
                        <th>Compatible units</th>
                        <th>Contact</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.hospitals.map((hospital) => (
                        <tr key={hospital.id}>
                          <td>{hospital.hospitalName}</td>
                          <td>
                            {[hospital.wereda, hospital.subcity]
                              .filter(Boolean)
                              .join(', ') || hospital.address}
                          </td>
                          <td>
                            {hospital.availableUnits}
                            {hospital.unitSummary.length > 0 && (
                              <ul className="availability-list">
                                {hospital.unitSummary.map(
                                  (unit) => (
                                    <li
                                      key={`${unit.bloodType}-${unit.component}`}
                                    >
                                      {
                                        BLOOD_TYPE_LABELS[
                                          unit.bloodType as BloodType
                                        ]
                                      }{' '}
                                      (
                                      {
                                        BLOOD_COMPONENT_LABELS[
                                          unit.component as BloodComponent
                                        ]
                                      }
                                      ): {unit.availableUnits}
                                    </li>
                                  )
                                )}
                              </ul>
                            )}
                          </td>
                          <td>
                            {hospital.phone}
                            {hospital.additionalPhone && (
                              <>
                                <br />
                                {hospital.additionalPhone}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dashboard-card">
              <h2>Nearby individual donors</h2>

              {result.donors.length === 0 && (
                <p>No matching donors found nearby.</p>
              )}

              {result.donors.length > 0 && (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Donor</th>
                        <th>Blood type</th>
                        <th>Location</th>
                        <th>Last donation</th>
                        <th>Contact</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.donors.map((donor) => (
                        <tr key={donor.donorProfileId}>
                          <td>{donor.displayName}</td>
                          <td>
                            {donor.bloodType
                              ? BLOOD_TYPE_LABELS[
                                  donor.bloodType as BloodType
                                ]
                              : 'Not set'}
                          </td>
                          <td>
                            {[donor.wereda, donor.subcity]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </td>
                          <td>
                            {formatDate(donor.lastDonation)}
                          </td>
                          <td>
                            {donor.contactAllowed &&
                            donor.contactPhone
                              ? donor.contactPhone
                              : 'Contact not shared'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default HospitalSearchPage
