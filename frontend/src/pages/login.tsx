import { useState } from 'react'

function Login() {
  const [loginType, setLoginType] = useState('')

  return (
    <div className="login-page">

      <div className="login-container">

        <h1>Login</h1>

        <p className="login-introduction">
          How do you want to login?
        </p>

        {!loginType && (
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
        )}

        {loginType === 'individual' && (
          <div>
            <h2>Individual Donor Login</h2>

            <button
              className="back-button"
              onClick={() => setLoginType('')}
            >
              Back
            </button>
          </div>
        )}

        {loginType === 'hospital' && (
          <div>
            <h2>Hospital / Clinic Login</h2>

            <button
              className="back-button"
              onClick={() => setLoginType('')}
            >
              Back
            </button>
          </div>
        )}

      </div>

    </div>
  )
}

export default Login
