import {
  useState,
  type FormEvent,
} from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { login } from '../services/auth.service'
import { dashboardPathForUser } from '../utils/dashboard'

type LoginType =
  | 'individual'
  | 'hospital'
  | 'doctor'
  | 'admin'
  | null

const LOGIN_OPTIONS: Record<
  Exclude<LoginType, null>,
  {
    heading: string
    accountType: 'INDIVIDUAL' | 'HOSPITAL'
    requiredRole?: string
    roleError?: string
  }
> = {
  individual: {
    heading: 'Individual Donor Login',
    accountType: 'INDIVIDUAL',
    requiredRole: 'DONOR',
    roleError:
      'This account does not have individual donor access.',
  },
  hospital: {
    heading: 'Hospital / Clinic Login',
    accountType: 'HOSPITAL',
    requiredRole: 'HOSPITAL_STAFF',
    roleError:
      'This account does not have hospital access.',
  },
  doctor: {
    heading: 'Clinical Reviewer Login',
    accountType: 'INDIVIDUAL',
    requiredRole: 'DOCTOR',
    roleError:
      'This account does not have clinical reviewer access.',
  },
  admin: {
    heading: 'Administrator Login',
    accountType: 'INDIVIDUAL',
    requiredRole: 'ADMIN',
    roleError: 'This account does not have administrator access.',
  },
}

function Login() {
  const [loginType, setLoginType] = useState<LoginType>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { loginUser, user, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const registrationState = location.state as {
    registrationSuccess?: boolean
    pendingApproval?: boolean
  } | null

  const registrationSuccess =
    registrationState?.registrationSuccess === true

  const pendingApproval =
    registrationState?.pendingApproval === true

  // An already signed-in user (session restored by AuthProvider or after a
  // successful login) should never see the login page; redirect them to the
  // dashboard that matches their role.
  if (user && token) {
    return (
      <Navigate
        to={dashboardPathForUser(user)}
        replace
      />
    )
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!loginType || loading) {
      return
    }

    setError('')
    setLoading(true)

    const option = LOGIN_OPTIONS[loginType]

    try {
      const response = await login({
        email: email.trim().toLowerCase(),
        password,
        accountType: option.accountType,
      })

      if (
        option.requiredRole &&
        response.user.role !== option.requiredRole
      ) {
        throw new Error(
          option.roleError ??
            'This account cannot access that dashboard.'
        )
      }

      loginUser(response.token, response.user)

      navigate(dashboardPathForUser(response.user), {
        replace: true,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to log in. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    if (loading) {
      return
    }

    setLoginType(null)
    setEmail('')
    setPassword('')
    setError('')
  }

  return (
    <main className="login-page">
      <div className="login-container">
        {registrationSuccess && (
          <p className="register-success" role="status">
            {pendingApproval
              ? 'Your clinical reviewer account was created. An administrator must activate it before you can sign in.'
              : 'Your account was created successfully. Please sign in to continue.'}
          </p>
        )}

        {!loginType ? (
          <>
            <h1>Login</h1>

            <p className="login-introduction">
              How do you want to log in?
            </p>

            <div className="login-choice">
              <button
                type="button"
                className="login-choice-button"
                onClick={() => {
                  setLoginType('individual')
                  setError('')
                }}
              >
                Individual Donor
              </button>

              <button
                type="button"
                className="login-choice-button"
                onClick={() => {
                  setLoginType('hospital')
                  setError('')
                }}
              >
                Hospital / Clinic
              </button>

              <button
                type="button"
                className="login-choice-button"
                onClick={() => {
                  setLoginType('doctor')
                  setError('')
                }}
              >
                Clinical Reviewer
              </button>

              <button
                type="button"
                className="login-choice-button"
                onClick={() => {
                  setLoginType('admin')
                  setEmail('admin@mekakel.com')
                  setPassword('Password1!')
                  setError('')
                }}
              >
                Administrator
              </button>
            </div>

            <p className="login-link">
              Don't have an account?{' '}
              <Link to="/register">
                Register here
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2>{LOGIN_OPTIONS[loginType].heading}</h2>

            <form onSubmit={handleLogin}>
              <div className="login-form-group">
                <label htmlFor="login-email">
                  Email Address
                </label>

                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError('')
                  }}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              <div className="login-form-group">
                <label htmlFor="login-password">
                  Password
                </label>

                <input
                  id="login-password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <p
                  className="login-error"
                  role="alert"
                >
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

            {loginType !== 'admin' && (
              <p className="login-link">
                <Link to="/forgot-password">
                  Forgot Password?
                </Link>
              </p>
            )}

            <button
              type="button"
              className="back-button"
              onClick={handleBack}
              disabled={loading}
            >
              Back
            </button>

            {loginType !== 'admin' && (
              <p className="login-link">
                Don't have an account?{' '}
                <Link to="/register">
                  Register here
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default Login