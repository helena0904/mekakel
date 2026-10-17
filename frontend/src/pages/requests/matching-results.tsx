import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import MatchResults from '../../components/requests/match-results'
import type { MatchingResult } from '../../services/matching.service'
import { getMatches } from '../../services/matching.service'
import { BLOOD_COMPONENT_LABELS } from '../../services/inventory.service'
import { BLOOD_TYPE_LABELS } from '../../services/donor.service'
import { REQUEST_URGENCY_LABELS } from '../../services/blood-request.service'

function MatchingResultsPage() {
  const { id } = useParams()

  const requestId = Number(id)

  const [matches, setMatches] =
    useState<MatchingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const validId = Number.isInteger(requestId) && requestId > 0

  useEffect(() => {
    if (!validId) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const loaded = await getMatches(requestId)

        if (!cancelled) {
          setMatches(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to compute matching sources'
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
  }, [requestId, validId])

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to={`/hospital/requests/${requestId}`}
          className="back-link"
        >
          ← Back to request
        </Link>

        <h1>Matching sources</h1>

        {!validId && (
          <p className="register-error" role="alert">
            Invalid blood request id
          </p>
        )}

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {validId && loading && (
          <p role="status">
            Searching eligible inventory and donors…
          </p>
        )}

        {!loading && matches && (
          <>
            <section className="dashboard-card">
              <h2>Request</h2>

              <p>
                Component:{' '}
                <strong>
                  {
                    BLOOD_COMPONENT_LABELS[
                      matches.request.component
                    ]
                  }
                </strong>
              </p>

              <p>
                Blood type:{' '}
                <strong>
                  {
                    BLOOD_TYPE_LABELS[
                      matches.request.bloodType
                    ]
                  }
                </strong>
              </p>

              <p>
                Required units:{' '}
                <strong>
                  {matches.request.requiredUnits}
                </strong>
              </p>

              <p>
                Urgency:{' '}
                <strong>
                  {
                    REQUEST_URGENCY_LABELS[
                      matches.request.urgency
                    ]
                  }
                </strong>
              </p>

              <p>
                Location: {matches.request.location || '—'}
              </p>
            </section>

            <MatchResults result={matches} />
          </>
        )}
      </div>
    </main>
  )
}

export default MatchingResultsPage
