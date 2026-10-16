import type { MatchingResult } from '../../services/matching.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import {
  BLOOD_TYPE_LABELS,
  formatDate,
} from '../../services/donor.service'

interface MatchResultsProps {
  result: MatchingResult
}

function MatchResults({ result }: MatchResultsProps) {
  const { units, donors, summary, disclaimer } = result

  return (
    <>
      <section className="dashboard-card">
        <h2>Matching summary</h2>

        <p>
          Compatible units found:{' '}
          <strong>{summary.compatibleUnits}</strong> of{' '}
          {summary.requiredUnits} requested
          {summary.shortfall > 0 && (
            <>
              {' '}
              — shortfall of{' '}
              <strong>{summary.shortfall}</strong> unit
              {summary.shortfall === 1 ? '' : 's'}
            </>
          )}
        </p>

        <p>
          Eligible volunteer donors:{' '}
          <strong>{summary.compatibleDonors}</strong>
        </p>

        <p className="verification-notes">
          {disclaimer}
        </p>
      </section>

      <section className="form-section">
        <h2>Hospital inventory matches (FEFO)</h2>

        <p className="section-description">
          Only screened, confirmed, unexpired and currently
          available units compatible with the request are
          listed, earliest expiry first.
        </p>

        {units.length === 0 ? (
          <p>
            No compatible hospital inventory is currently
            available.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>FEFO</th>
                  <th>Bag ID</th>
                  <th>Type</th>
                  <th>Component</th>
                  <th>Expires</th>
                  <th>Hospital</th>
                  <th>Storage</th>
                </tr>
              </thead>

              <tbody>
                {units.map((unit) => (
                  <tr key={unit.unitId}>
                    <td>{unit.fefoRank}</td>

                    <td>{unit.bagId}</td>

                    <td>
                      {BLOOD_TYPE_LABELS[unit.bloodType]}
                    </td>

                    <td>
                      {BLOOD_COMPONENT_LABELS[unit.component]}
                    </td>

                    <td>
                      {formatDate(unit.expiryDate)}
                      <span className="cell-note">
                        {unit.daysUntilExpiry}{' '}
                        {unit.daysUntilExpiry === 1
                          ? 'day'
                          : 'days'}{' '}
                        left
                      </span>
                    </td>

                    <td>
                      {unit.hospitalName}
                      {unit.isOwnHospital && (
                        <span className="cell-note">
                          Your hospital
                        </span>
                      )}
                    </td>

                    <td>{unit.storageLocation || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="form-section">
        <h2>Eligible volunteer donors</h2>

        <p className="section-description">
          Ranked by availability, location and request
          urgency. Donor contact details are only shown when
          the donor has consented; medical details are never
          shown.
        </p>

        {donors.length === 0 ? (
          <p>
            No eligible compatible donors are currently
            available.
          </p>
        ) : (
          <ul className="report-list">
            {donors.map((donor) => (
              <li key={donor.donorProfileId} className="report-item">
                <div>
                  <strong>
                    #{donor.rank} {donor.displayName}
                  </strong>

                  <span className="status-badge status-badge-info">
                    {BLOOD_TYPE_LABELS[donor.bloodType]}
                  </span>

                  <p>
                    {donor.address ||
                      'Location withheld'}
                    {donor.contactAllowed && donor.contactPhone
                      ? ` — ${donor.contactPhone}`
                      : ' — Contact withheld (no consent)'}
                  </p>

                  {donor.reasons.length > 0 && (
                    <p className="cell-note">
                      {donor.reasons.join(' • ')}
                    </p>
                  )}

                  {donor.lastDonation && (
                    <p className="cell-note">
                      Last donation:{' '}
                      {formatDate(donor.lastDonation)}
                    </p>
                  )}
                </div>

                <span className="status-badge status-badge-approved">
                  Eligible
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default MatchResults
