import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'

import {
  addStaff,
  canManageHospital,
  getHospitalProfile,
  getStaff,
  HOSPITAL_STAFF_ROLE_LABELS,
  removeStaffMember,
  updateStaffMember,
} from '../../services/hospital.service'
import type {
  CreateStaffInput,
  HospitalStaffMember,
  HospitalStaffRoleValue,
} from '../../services/hospital.service'

const ASSIGNABLE_ROLES: Array<
  Exclude<HospitalStaffRoleValue, 'OWNER'>
> = ['ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER']

function HospitalStaffPage() {
  const [staff, setStaff] = useState<
    HospitalStaffMember[]
  >([])
  const [role, setRole] =
    useState<HospitalStaffRoleValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffRole, setStaffRole] =
    useState<CreateStaffInput['staffRole']>('VIEWER')
  const [adding, setAdding] = useState(false)

  async function refresh() {
    setStaff(await getStaff())
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loadedProfile = await getHospitalProfile()

        if (cancelled) {
          return
        }

        setRole(loadedProfile.role)

        if (canManageHospital(loadedProfile.role)) {
          const loadedStaff = await getStaff()

          if (!cancelled) {
            setStaff(loadedStaff)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load hospital staff'
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

  const canManage = canManageHospital(role)

  async function handleAdd(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (adding) {
      return
    }

    setError('')
    setSuccess('')
    setAdding(true)

    try {
      await addStaff({
        name: name.trim(),
        email: email.trim(),
        password,
        staffRole,
      })

      setSuccess('Staff member added.')
      setName('')
      setEmail('')
      setPassword('')
      setStaffRole('VIEWER')
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add staff member'
      )
    } finally {
      setAdding(false)
    }
  }

  async function handleRoleChange(
    member: HospitalStaffMember,
    nextRole: Exclude<HospitalStaffRoleValue, 'OWNER'>
  ) {
    setError('')
    setSuccess('')

    try {
      const updated = await updateStaffMember(member.id, {
        staffRole: nextRole,
      })

      setStaff((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update staff role'
      )
    }
  }

  async function handleToggleActive(
    member: HospitalStaffMember
  ) {
    setError('')
    setSuccess('')

    try {
      const updated = await updateStaffMember(member.id, {
        isActive: !member.isActive,
      })

      setStaff((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update staff member'
      )
    }
  }

  async function handleRemove(member: HospitalStaffMember) {
    if (
      !window.confirm(
        `Remove ${member.user.name} from this hospital?`
      )
    ) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await removeStaffMember(member.id)
      setStaff((previous) =>
        previous.filter((item) => item.id !== member.id)
      )
      setSuccess('Staff member removed.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove staff member'
      )
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-container">
          <p role="status">Loading staff…</p>
        </div>
      </main>
    )
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

        <h1>Hospital Staff</h1>

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

        {!canManage && (
          <section className="dashboard-card">
            <p>
              Only hospital owners and administrators can
              manage staff memberships.
            </p>
          </section>
        )}

        {canManage && (
          <>
            <form
              className="register-form"
              onSubmit={handleAdd}
            >
              <section className="form-section">
                <h2>Add a staff member</h2>

                <p className="section-description">
                  Staff members receive access only to this
                  institution's records.
                </p>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="staff-name">
                      Full name
                    </label>
                    <input
                      id="staff-name"
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      required
                      disabled={adding}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-email">
                      Email
                    </label>
                    <input
                      id="staff-email"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      required
                      disabled={adding}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="staff-password">
                      Temporary password
                    </label>
                    <input
                      id="staff-password"
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      required
                      disabled={adding}
                    />
                    <small>
                      At least 8 characters with uppercase,
                      lowercase, number and special character.
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-role">
                      Role
                    </label>
                    <select
                      id="staff-role"
                      value={staffRole}
                      onChange={(event) =>
                        setStaffRole(
                          event.target
                            .value as CreateStaffInput['staffRole']
                        )
                      }
                      disabled={adding}
                    >
                      {ASSIGNABLE_ROLES.map((option) => (
                        <option key={option} value={option}>
                          {HOSPITAL_STAFF_ROLE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="register-button"
                  disabled={adding}
                >
                  {adding ? 'Adding...' : 'Add staff member'}
                </button>
              </section>
            </form>

            <section className="form-section">
              <h2>Members</h2>

              {staff.length === 0 && (
                <p>No staff members yet.</p>
              )}

              {staff.length > 0 && (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {staff.map((member) => {
                        const isOwner =
                          member.staffRole === 'OWNER'

                        return (
                          <tr key={member.id}>
                            <td>{member.user.name}</td>
                            <td>{member.user.email}</td>
                            <td>
                              {isOwner ? (
                                HOSPITAL_STAFF_ROLE_LABELS[
                                  member.staffRole
                                ]
                              ) : (
                                <select
                                  value={member.staffRole}
                                  onChange={(event) =>
                                    handleRoleChange(
                                      member,
                                      event.target
                                        .value as Exclude<
                                        HospitalStaffRoleValue,
                                        'OWNER'
                                      >
                                    )
                                  }
                                >
                                  {ASSIGNABLE_ROLES.map(
                                    (option) => (
                                      <option
                                        key={option}
                                        value={option}
                                      >
                                        {
                                          HOSPITAL_STAFF_ROLE_LABELS[
                                            option
                                          ]
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              )}
                            </td>
                            <td>
                              <span
                                className={
                                  member.isActive
                                    ? 'status-badge status-badge-approved'
                                    : 'status-badge status-badge-rejected'
                                }
                              >
                                {member.isActive
                                  ? 'Active'
                                  : 'Inactive'}
                              </span>
                            </td>
                            <td className="table-actions">
                              {!isOwner && (
                                <>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                      handleToggleActive(
                                        member
                                      )
                                    }
                                  >
                                    {member.isActive
                                      ? 'Deactivate'
                                      : 'Activate'}
                                  </button>

                                  <button
                                    type="button"
                                    className="secondary-button danger-button"
                                    onClick={() =>
                                      handleRemove(member)
                                    }
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
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

export default HospitalStaffPage
