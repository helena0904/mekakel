import { useState } from 'react'

function Login() {
  const [loginType, setLoginType] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotPassword, setForgotPassword] = useState(false)

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
           {/* Individual Donor Login Form */}


            <h2>Individual Donor Login</h2>

            <form>

              <div className="login-form-group">

                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />

              </div>

              <div className="login-form-group">

                <label>Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />

              </div>

              <button
                type="submit"
                className="login-button"
              >
                Login
              </button>

            </form>

            <button
              className="forgot-password"
              onClick={() => setForgotPassword(true)}
            >
              Forgot password?
            </button>

            <button
              className="back-button"
              onClick={() => setLoginType('')}
            >
              Back
            </button>

          </div>
        )}

        {loginType === 'hospital' && !forgotPassword && (
          <div>
                        {/* Hospital / Clinic Login Form */}

            <h2>Hospital / Clinic Login</h2>

            <form>

              <div className="login-form-group">

                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />

              </div>

              <div className="login-form-group">

                <label>Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />

              </div>

              <button
                type="submit"
                className="login-button"
              >
                Login
              </button>

            </form>
            <button
              className="forgot-password"
              onClick={() => setForgotPassword(true)}
            >
              Forgot password?
            </button>

            <button
              className="back-button"
              onClick={() => setLoginType('')}
            >
              Back
            </button>

          </div>
        )}

        {forgotPassword && (
          <div>

            <h2>Recover Password</h2>

            <p className="login-introduction">
              Enter your email address and we will send you a verification code to recover your account.
            </p>

            <form>

              <div className="login-form-group">

                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
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
              onClick={() => setForgotPassword(false)}
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
