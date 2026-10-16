import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import RequestForm from '../../components/requests/request-form'
import type { BloodRequest } from '../../services/blood-request.service'
import { canManageRequests } from '../../services/blood-request.service'
import { getHospitalProfile } from '../../services/hospital.service'
import type { HospitalStaffRoleValue } from '../../services/hospital.service'

function CreateRequestPage() {
  const navigate = useNavigate()

  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
              : 'Unable to load your hospital profile'
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
  }, [])

  function handleSaved(request: BloodRequest) {
    navigate(`/hospital/requests/${request.id}`, {
      replace: true,
    })
  }

  const canManage = canManageRequests(role)

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link
          to="/hospital/requests"
          className="back-link"
        >
          ← Back to requests
        </Link>

        <h1>Create blood request</h1>

        {error && (
          <p className="register-error" role="alert">
            {error}
          </p>
        )}

        {loading && <p role="status">Loading…</p>}

        {!loading && !canManage && (
          <section className="verification-status">
            <div className="verification-status-header">
              <h2>Permission required</h2>
            </div>

            <p>
              Your hospital role does not allow creating blood
              requests.
            </p>
          </section>
        )}

        {!loading && canManage && (
          <RequestForm onSaved={handleSaved} />
        )}
      </div>
    </main>
  )
}

export default CreateRequestPage
