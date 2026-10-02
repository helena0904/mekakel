import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { login } from '../services/auth.service'

function Login() {
  const [loginType, setLoginType] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotPassword, setForgotPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { loginUser } = useAuth()

  async function handleLogin(e: FormEvent) {
    e.preventDefault()

    setError('')
    setLoading(true)

    try {
      const accountType =
        loginType === 'individual' ? 'INDIVIDUAL' : 'HOSPITAL'

      const response = await login({
        email,
        password,
        accountType,
      })

      loginUser(response.token, response.user)

      window.location.href = '/'
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">

        {!loginType && (
          <>
            <h1>Login</h1>

            <p className="login-introduction">
              How do you want to login?
            </p>

            <div className="login-choice">

              <button
                className="login-choice-button"
                onClick={() => setLoginType('individual')}
              >
                Individual Donor
              </button>

              <button
                className="login-choice-button"
                onClick={() => setLoginType('hospital')}
              >
                Hospital / Clinic
              </button>

            </div>
          </>
        )}

        {loginType === 'individual' && !forgotPassword && (
          <div>
            <h2>Individual Donor Login</h2>

            <form onSubmit={handleLogin}>

              <div className="login-form-group">
                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="login-form-group">
                <label>Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && (
                <p className="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

            </form>

            <button
              className="forgot-password"
              onClick={() => {
                setForgotPassword(true)
                setError('')
              }}
            >
              Forgot password?
            </button>

            <button
              className="back-button"
              onClick={() => {
                setLoginType('')
                setError('')
              }}
            >
              Back
            </button>
          </div>
        )}

        {loginType === 'hospital' && !forgotPassword && (
          <div>
            <h2>Hospital / Clinic Login</h2>

            <form onSubmit={handleLogin}>

              <div className="login-form-group">
                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="login-form-group">
                <label>Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && (
                <p className="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

            </form>

            <button
              className="forgot-password"
              onClick={() => {
                setForgotPassword(true)
                setError('')
              }}
            >
              Forgot password?
            </button>

            <button
              className="back-button"
              onClick={() => {
                setLoginType('')
                setError('')
              }}
            >
              Back
            </button>
          </div>
        )}

        {forgotPassword && (
          <div>
            <h2>Recover Password</h2>

            <p className="login-introduction">
              Enter your email address and we will send you a verification
              code to recover your account.
            </p>

            <form>

              <div className="login-form-group">
                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button
                type="submit"
                className="login-button"
              >
                Send Verification Code
              </button>

            </form>

            <button
              className="back-button"
              onClick={() => {
                setForgotPassword(false)
                setError('')
              }}
            >
              Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default Login
