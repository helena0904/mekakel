import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  listUsers,
  updateUser,
  USER_ROLE_LABELS,
  USER_ROLES,
} from '../../services/admin.service'
import type {
  AdminUser,
  UserRoleValue,
} from '../../services/admin.service'

function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<
    UserRoleValue | ''
  >('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const loaded = await listUsers({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
      })

      setUsers(loaded)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load users'
      )
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [load])

  async function handleRoleChange(
    user: AdminUser,
    role: UserRoleValue
  ) {
    if (busyId !== null || role === user.role) {
      return
    }

    setBusyId(user.id)
    setError('')
    setSuccess('')

    try {
      const updated = await updateUser(user.id, { role })

      setUsers((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
      setSuccess(`Role updated for ${updated.name}.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the user'
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(user: AdminUser) {
    if (busyId !== null) {
      return
    }

    setBusyId(user.id)
    setError('')
    setSuccess('')

    try {
      const updated = await updateUser(user.id, {
        isActive: !user.isActive,
      })

      setUsers((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      )
      setSuccess(
        `${updated.name} ${
          updated.isActive ? 'activated' : 'deactivated'
        }.`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the user'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <Link to="/admin-dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <h1>User management</h1>

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

        <section className="form-section">
          <div className="filter-bar">
            <div className="form-group">
              <label htmlFor="user-search">Search</label>
              <input
                id="user-search"
                type="search"
                value={search}
                placeholder="Name or email"
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-role-filter">
                Role
              </label>
              <select
                id="user-role-filter"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value as UserRoleValue | ''
                  )
                }
              >
                <option value="">All roles</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && <p role="status">Loading…</p>}

        {!loading && users.length === 0 && (
          <p>No users match the current filters.</p>
        )}

        {users.length > 0 && (
          <section className="form-section">
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
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={busyId !== null}
                        onChange={(event) =>
                          handleRoleChange(
                            user,
                            event.target.value as UserRoleValue
                          )
                        }
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {USER_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={
                          user.isActive
                            ? 'status-badge status-badge-approved'
                            : 'status-badge status-badge-rejected'
                        }
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busyId !== null}
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.isActive
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  )
}

export default UserManagementPage
