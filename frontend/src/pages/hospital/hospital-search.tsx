import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchDonorReportObjectUrl,
  getNearbyDonorDetail,
  requestDonorBlood,
  searchNearby,
} from '../../services/hospital.service'
import type {
  HospitalDonorDetail,
  HospitalSearchResult,
  NearbyHospital,
} from '../../services/hospital.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import type { BloodComponent } from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'
import type { BloodType } from '../../services/donor.service'

const VERIFICATION_LABELS: Record<string, string> = {
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ADDITIONAL_INFO_REQUIRED: 'Additional information required',
}

const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending review',
  VERIFIED: 'Approved',
  REJECTED: 'Rejected',
  ADDITIONAL_INFO_REQUIRED: 'Additional information required',
}

function labelFor(
  labels: Record<string, string>,
  value: string
): string {
  if (labels[value]) {
    return labels[value]
  }

  const normalized = value.replaceAll('_', ' ').toLowerCase()

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function HospitalSearchPage() {
  const [result, setResult] =
    useState<HospitalSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedHospital, setSelectedHospital] =
    useState<NearbyHospital | null>(null)
  const [selectedDonorId, setSelectedDonorId] = useState<
    number | null
  >(null)
  const [donorDetail, setDonorDetail] =
    useState<HospitalDonorDetail | null>(null)
  const [donorLoading, setDonorLoading] = useState(false)
  const [donorError, setDonorError] = useState('')
  const [openingReportId, setOpeningReportId] = useState<
    number | null
  >(null)
  const [requestingDonorId, setRequestingDonorId] = useState<
    number | null
  >(null)
  const [requestNotice, setRequestNotice] = useState('')

  const detailRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (selectedHospital || selectedDonorId !== null) {
      detailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [selectedHospital, selectedDonorId])

  function closeDetails() {
    setSelectedHospital(null)
    setSelectedDonorId(null)
    setDonorDetail(null)
    setDonorError('')
    setRequestNotice('')
  }

  function handleSelectHospital(hospital: NearbyHospital) {
    setSelectedDonorId(null)
    setDonorDetail(null)
    setDonorError('')
    setRequestNotice('')
    setSelectedHospital(hospital)
  }

  async function handleSearch() {
    if (loading) {
      return
    }

    setError('')
    setLoading(true)
    closeDetails()

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

  async function handleSelectDonor(donorProfileId: number) {
    setSelectedHospital(null)
    setSelectedDonorId(donorProfileId)
    setDonorDetail(null)
    setDonorError('')
    setRequestNotice('')
    setDonorLoading(true)

    try {
      const loaded = await getNearbyDonorDetail(donorProfileId)
      setDonorDetail(loaded)
    } catch (err) {
      setDonorError(
        err instanceof Error
          ? err.message
          : 'Unable to load donor details'
      )
    } finally {
      setDonorLoading(false)
    }
  }

  async function handleRequestBlood() {
    if (!donorDetail || requestingDonorId !== null) {
      return
    }

    setRequestingDonorId(donorDetail.donorProfileId)
    setDonorError('')
    setRequestNotice('')

    try {
      const result = await requestDonorBlood(
        donorDetail.donorProfileId
      )

      setRequestNotice(
        `${result.donorName} has been notified that your hospital needs blood now.`
      )
    } catch (err) {
      setDonorError(
        err instanceof Error
          ? err.message
          : 'Unable to notify the donor'
      )
    } finally {
      setRequestingDonorId(null)
    }
  }

  async function handleOpenReport(reportId: number) {
    if (openingReportId !== null) {
      return
    }

    setOpeningReportId(reportId)
    setDonorError('')

    try {
      const objectUrl = await fetchDonorReportObjectUrl(reportId)
      window.open(objectUrl, '_blank', 'noopener')
    } catch (err) {
      setDonorError(
        err instanceof Error
          ? err.message
          : 'Unable to open the medical report'
      )
    } finally {
      setOpeningReportId(null)
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
          your facility. Select a hospital to view its contact and stock
          details, or select an individual donor to review their clinical
          profile and uploaded medical report. Fayda numbers are never
          shared in these results.
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
                        <th>Details</th>
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
                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                handleSelectHospital(hospital)
                              }
                            >
                              View details
                            </button>
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
                        <th>Details</th>
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
                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                handleSelectDonor(
                                  donor.donorProfileId
                                )
                              }
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {(selectedHospital || selectedDonorId !== null) && (
              <section
                ref={detailRef}
                className="dashboard-card"
                aria-live="polite"
              >
                <div className="section-heading">
                  <h2>
                    {selectedHospital
                      ? selectedHospital.hospitalName
                      : 'Individual donor details'}
                  </h2>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeDetails}
                  >
                    Close
                  </button>
                </div>

                {selectedHospital && (
                  <>
                    <p>
                      <strong>Location:</strong>{' '}
                      {[selectedHospital.wereda, selectedHospital.subcity]
                        .filter(Boolean)
                        .join(', ') || selectedHospital.address}
                    </p>

                    <p>
                      <strong>Address:</strong>{' '}
                      {selectedHospital.address}
                    </p>

                    <p>
                      <strong>Phone:</strong>{' '}
                      {selectedHospital.phone}
                    </p>

                    {selectedHospital.additionalPhone && (
                      <p>
                        <strong>Additional phone:</strong>{' '}
                        {selectedHospital.additionalPhone}
                      </p>
                    )}

                    <p>
                      <strong>Compatible units available:</strong>{' '}
                      {selectedHospital.availableUnits}
                    </p>

                    <h3>Available blood units</h3>

                    {selectedHospital.unitDetails.length === 0 ? (
                      <p>
                        No compatible units are currently available.
                      </p>
                    ) : (
                      <>
                        <ul className="donor-links">
                          {selectedHospital.unitSummary.map((unit) => (
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
                              ): {unit.availableUnits}{' '}
                              {unit.availableUnits === 1
                                ? 'unit'
                                : 'units'}
                            </li>
                          ))}
                        </ul>

                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Blood ID</th>
                                <th>Blood type</th>
                                <th>Component</th>
                                <th>Collected</th>
                                <th>Expires</th>
                              </tr>
                            </thead>

                            <tbody>
                              {selectedHospital.unitDetails.map(
                                (unit) => (
                                  <tr key={unit.id}>
                                    <td>{unit.bagId}</td>
                                    <td>
                                      {
                                        BLOOD_TYPE_LABELS[
                                          unit.bloodType as BloodType
                                        ]
                                      }
                                    </td>
                                    <td>
                                      {
                                        BLOOD_COMPONENT_LABELS[
                                          unit.component as BloodComponent
                                        ]
                                      }
                                    </td>
                                    <td>
                                      {formatDate(
                                        unit.collectionDate
                                      )}
                                    </td>
                                    <td>
                                      {formatDate(unit.expiryDate)}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}

                {selectedDonorId !== null && (
                  <>
                    {donorLoading && (
                      <p role="status">Loading donor details…</p>
                    )}

                    {donorError && (
                      <p className="register-error" role="alert">
                        {donorError}
                      </p>
                    )}

                    {donorDetail && (
                      <>
                        <p>
                          <strong>Name:</strong>{' '}
                          {donorDetail.displayName}
                        </p>

                        <p>
                          <strong>Blood type:</strong>{' '}
                          {donorDetail.bloodType
                            ? BLOOD_TYPE_LABELS[
                                donorDetail.bloodType as BloodType
                              ]
                            : 'Not set'}
                        </p>

                        <p>
                          <button
                            type="button"
                            className="register-button"
                            disabled={requestingDonorId !== null}
                            onClick={handleRequestBlood}
                          >
                            {requestingDonorId ===
                            donorDetail.donorProfileId
                              ? 'Sending request…'
                              : 'We need blood now'}
                          </button>
                        </p>

                        {requestNotice && (
                          <p
                            className="register-success"
                            role="status"
                          >
                            {requestNotice}
                          </p>
                        )}

                        <p>
                          <strong>Age:</strong> {donorDetail.age}{' '}
                          · <strong>Weight:</strong>{' '}
                          {donorDetail.weight} kg ·{' '}
                          <strong>Height:</strong>{' '}
                          {donorDetail.height} cm
                        </p>

                        <p>
                          <strong>Date of birth:</strong>{' '}
                          {formatDate(donorDetail.dateOfBirth)}
                        </p>

                        <p>
                          <strong>Location:</strong>{' '}
                          {[donorDetail.wereda, donorDetail.subcity]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </p>

                        <p>
                          <strong>Address:</strong>{' '}
                          {donorDetail.address ?? 'Not shared'}
                        </p>

                        <p>
                          <strong>Phone:</strong>{' '}
                          {donorDetail.phone ?? 'Contact not shared'}
                        </p>

                        {donorDetail.additionalPhone && (
                          <p>
                            <strong>Additional phone:</strong>{' '}
                            {donorDetail.additionalPhone}
                          </p>
                        )}

                        <p>
                          <strong>Email:</strong>{' '}
                          {donorDetail.email ?? 'Contact not shared'}
                        </p>

                        <p>
                          <strong>Availability:</strong>{' '}
                          {labelFor(
                            {},
                            donorDetail.currentAvailability
                          )}{' '}
                          · <strong>Active status:</strong>{' '}
                          {labelFor({}, donorDetail.activeStatus)}
                        </p>

                        <p>
                          <strong>Verification:</strong>{' '}
                          {labelFor(
                            VERIFICATION_LABELS,
                            donorDetail.verificationStatus
                          )}
                        </p>

                        <p>
                          <strong>Last donation:</strong>{' '}
                          {formatDate(donorDetail.lastDonation)} ·{' '}
                          <strong>Next eligible:</strong>{' '}
                          {donorDetail.nextEligibleDate ??
                            'Eligible now'}
                        </p>

                        <h3>Medical reports</h3>

                        {donorDetail.reportsRestricted ? (
                          <p>
                            Medical reports are available only
                            after this donor accepts your blood
                            request. Send a request and wait for
                            the donor to accept.
                          </p>
                        ) : donorDetail.medicalReports.length === 0 ? (
                          <p>No medical report was uploaded.</p>
                        ) : (
                          <ul className="donor-links">
                            {donorDetail.medicalReports.map(
                              (report) => (
                                <li key={report.id}>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={openingReportId !== null}
                                    onClick={() =>
                                      handleOpenReport(report.id)
                                    }
                                  >
                                    {openingReportId === report.id
                                      ? 'Opening…'
                                      : `Open ${report.reportType.toLowerCase()} report`}
                                  </button>{' '}
                                  <small>
                                    {labelFor(
                                      REPORT_STATUS_LABELS,
                                      report.verificationStatus
                                    )}{' '}
                                    · uploaded{' '}
                                    {formatDate(report.createdAt)}
                                  </small>

                                  {report.rejectionReason && (
                                    <small className="cell-note">
                                      Reason: {report.rejectionReason}
                                    </small>
                                  )}
                                </li>
                              )
                            )}
                          </ul>
                        )}

                        <h3>Availability schedule</h3>

                        {donorDetail.availabilities.length === 0 ? (
                          <p>No availability schedule was provided.</p>
                        ) : (
                          <ul className="donor-links">
                            {donorDetail.availabilities.map(
                              (slot) => (
                                <li key={`${slot.day}-${slot.time}`}>
                                  {labelFor({}, slot.day)}:{' '}
                                  {slot.time}
                                </li>
                              )
                            )}
                          </ul>
                        )}

                        <h3>Donation history</h3>

                        {donorDetail.donationHistory.length === 0 ? (
                          <p>No previous donations recorded.</p>
                        ) : (
                          <ul className="donor-links">
                            {donorDetail.donationHistory.map(
                              (record) => (
                                <li key={record.id}>
                                  {formatDate(record.donatedAt)}
                                  {record.facilityName
                                    ? ` · ${record.facilityName}`
                                    : ''}
                                  {record.units
                                    ? ` · ${record.units} unit(s)`
                                    : ''}
                                </li>
                              )
                            )}
                          </ul>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default HospitalSearchPage
