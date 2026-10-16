import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import apiRequest from '../services/api'

interface ResetPasswordResponse {
  message: string
}

function ResetPassword() {
  const [searchParams, setSearchParams] = useSearchParams()

  const token = searchParams.get('token') ?? ''
  const hasValidTokenFormat = /^[a-f0-9]{64}$/i.test(token)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (loading || success) {
      return
    }

    setError('')

    if (!hasValidTokenFormat) {
      setError('This password reset link is invalid.')
      return
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError('Password is too long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await apiRequest<ResetPasswordResponse>(
        '/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            password,
          }),
        },
      )

      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
      setSearchParams({}, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reset your password. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-container">
        <h1>Reset Password</h1>

        {success ? (
          <div
            className="reset-password-success"
            role="status"
          >
            <h2>Password Updated Successfully!</h2>

            <p>
              Your MEKAKEL account password has been changed.
            </p>

            <p>
              You can now log in using your new password.
            </p>

            <Link
              to="/login"
              className="back-button reset-password-link"
            >
              Go to Login
            </Link>
          </div>
        ) : !hasValidTokenFormat ? (
          <div className="reset-password-invalid">
            <p className="login-error" role="alert">
              This password reset link is invalid or missing.
            </p>

            <p className="reset-password-note">
              Please request a new password reset link.
            </p>

            <Link
              to="/forgot-password"
              className="back-button reset-password-link"
            >
              Request New Link
            </Link>
          </div>
        ) : (
          <>
            <p className="login-introduction">
              Enter and confirm your new password.
              Your reset link can only be used once
              and expires after 15 minutes.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="login-form-group">
                <label htmlFor="new-password">
                  New Password
                </label>

                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
              </div>

              <div className="login-form-group">
                <label htmlFor="confirm-new-password">
                  Confirm New Password
                </label>

                <input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setError('')
                  }}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
              </div>

              <label className="reset-password-toggle">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) =>
                    setShowPassword(event.target.checked)
                  }
                  disabled={loading}
                />
                Show passwords
              </label>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading
                  ? 'Updating Password...'
                  : 'Reset Password'}
              </button>
            </form>

            <Link
              to="/login"
              className="back-button reset-password-link"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </main>
  )
}

export default ResetPassword