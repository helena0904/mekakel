import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import apiRequest from '../services/api'

interface ForgotPasswordResponse {
  message: string
}

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      await apiRequest<ForgotPasswordResponse>(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        }
      )

      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to process your request. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-container">
        <h1>Forgot Password?</h1>

        <p className="login-introduction">
          Enter the email address associated with your
          Mekakel account. We will send you a password-reset link.
        </p>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label htmlFor="reset-email">
                Email Address
              </label>

              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                }}
                placeholder="Enter your registered email"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div
            className="register-success forgot-password-success"
            role="status"
          >
            <h2>Check Your Email</h2>

            <p>
              If an account exists with this email address,
              a password-reset link will be sent.
            </p>

            <p>
              The link expires after 15 minutes.
              Please check your inbox and spam folder.
            </p>
          </div>
        )}

        <Link
          to="/login"
          className="back-button forgot-password-back"
        >
          Back to Login
        </Link>

        {success && (
          <button
            type="button"
            className="forgot-password-retry"
            onClick={() => {
              setSuccess(false)
              setError('')
            }}
          >
            Try another email address
          </button>
        )}
      </div>
    </main>
  )
}

export default ForgotPassword