import { useState } from 'react'

function Login() {
  const [loginType, setLoginType] = useState('')
  const [institutionalEmail, setInstitutionalEmail] = useState('')
  const [password, setPassword] = useState('')

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

            {/*hospital login form*/}


            <h2>Hospital / Clinic Login</h2>

            <form>

              <div className="login-form-group">

                <label>Institutional Email</label>

                <input
                  type="email"
                  value={institutionalEmail}
                  onChange={(e) => setInstitutionalEmail(e.target.value)}
                  placeholder="Enter institutional email"
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