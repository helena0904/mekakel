import { useState } from 'react'
import { Link } from 'react-router-dom'

function Register() {
  const [registrationType, setRegistrationType] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)
  const [medicalWarning, setMedicalWarning] = useState(false)

  /* INDIVIDUAL DONOR STATES */

  const [fullName, setFullName] = useState('')
  const [reportType, setReportType] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  /* HOSPITAL / CLINIC STATES */

  const [hospitalPassword, setHospitalPassword] = useState('')
  const [hospitalConfirmPassword, setHospitalConfirmPassword] = useState('')

  /* INDIVIDUAL DONOR PASSWORD VALIDATION */

  const passwordIsStrong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword

  /* HOSPITAL PASSWORD VALIDATION */

  const hospitalPasswordIsStrong =
    hospitalPassword.length >= 8 &&
    /[A-Z]/.test(hospitalPassword) &&
    /[a-z]/.test(hospitalPassword) &&
    /[0-9]/.test(hospitalPassword) &&
    /[^A-Za-z0-9]/.test(hospitalPassword)

  const hospitalPasswordsMatch =
    hospitalPassword.length > 0 &&
    hospitalConfirmPassword.length > 0 &&
    hospitalPassword === hospitalConfirmPassword


  /* =========================================================
     1. CHOOSE REGISTRATION TYPE
     ========================================================= */

  if (!registrationType) {
    return (
      <main className="register-page">

        <div className="register-container">

          <h1>Register with MEKAKEL</h1>

          <p className="register-introduction">
            Please choose the type of account you want to create.
          </p>


          <section className="form-section">

            <h2>Register As</h2>

            <div className="registration-choice">

              <button
                type="button"
                className="register-button"
                onClick={() => setRegistrationType('donor')}
              >
                Individual Donor
              </button>


              <button
                type="button"
                className="register-button"
                onClick={() => setRegistrationType('hospital')}
              >
                Hospital / Clinic
              </button>

            </div>

          </section>


          <p className="login-link">

            Already have an account?{' '}

            <Link to="/login">
              Login
            </Link>

          </p>

        </div>

      </main>
    )
  }


  /* =========================================================
     2. BEFORE YOU REGISTER - INDIVIDUAL DONOR
     ========================================================= */

  if (registrationType === 'donor' && !showRegistration) {
    return (
      <main className="before-register-page">

        <div className="before-register-container">

          <h1>Before You Register</h1>

          <p className="before-register-introduction">
            Before registering as an individual volunteer blood donor
            with MEKAKEL, please read the following information carefully.
          </p>


          <section className="medical-warning">

            <h2>Important Medical Information</h2>

            <p>
              Individuals should not register as blood donors if their
              medical report shows a positive or affected result for
              any of the following conditions:
            </p>


            <ul>

              <li>HIV</li>

              <li>Hepatitis B</li>

              <li>Hepatitis C</li>

              <li>Syphilis</li>

              <li>
                Other transfusion-transmissible infections
              </li>

              <li>
                Low hemoglobin or anemia
              </li>

              <li>Pregnancy</li>

              <li>Recent childbirth</li>

              <li>Current illness or infection</li>

              <li>Low body weight</li>

              <li>
                Unstable blood pressure or vital signs
              </li>

              <li>Recent blood donation</li>

              <li>Certain medical conditions</li>

              <li>Certain medications</li>

              <li>
                Recent surgery or medical procedures
              </li>

            </ul>


            <div className="do-not-register">

              <h3>Do Not Proceed With Registration</h3>

              <p>
                If any of the conditions above apply to you or your
                medical report shows a positive or affected result,
                please do not proceed with donor registration.
              </p>

            </div>


            <div className="medical-information-note">

              <h3>Important</h3>

              <p>
                MEKAKEL does not perform laboratory testing.
                Medical testing must be performed by an authorized
                medical facility.
              </p>

              <p>
                Your medical report will be reviewed by an authorized
                Doctor/Verifier during the donor verification process.
              </p>

            </div>

          </section>


          <section className="before-register-continue">

            <h2>Ready to Continue?</h2>

            <p>
              If you have read and understood the information above,
              you can continue to the Individual Donor Registration form.
            </p>


            <label className="warning-checkbox">

              <input
                type="checkbox"
                checked={medicalWarning}
                onChange={(e) =>
                  setMedicalWarning(e.target.checked)
                }
              />

              <span>
                I have read and understood the donor registration
                requirements.
              </span>

            </label>


            <button
              type="button"
              className="register-button"
              disabled={!medicalWarning}
              onClick={() => setShowRegistration(true)}
            >
              Continue to Registration
            </button>


            <button
              type="button"
              className="back-button"
              onClick={() => {
                setRegistrationType('')
                setMedicalWarning(false)
              }}
            >
              Back
            </button>

          </section>

        </div>

      </main>
    )
  }


  /* =========================================================
     3. HOSPITAL / CLINIC REGISTRATION
     ========================================================= */

  if (registrationType === 'hospital') {
    return (
      <main className="register-page">

        <div className="register-container">

          <h1>Hospital / Clinic Registration</h1>

          <p className="register-introduction">
            Register your hospital or clinic with MEKAKEL to coordinate
            blood availability and requests with other healthcare facilities.
          </p>


          <form className="register-form">


            {/* HOSPITAL / CLINIC INFORMATION */}

            <section className="form-section">

              <h2>1. Hospital / Clinic Information</h2>


              <div className="form-group">

                <label htmlFor="hospitalName">
                  Hospital / Clinic Name
                </label>

                <input
                  type="text"
                  id="hospitalName"
                  name="hospitalName"
                  placeholder="Enter hospital or clinic name"
                  required
                />

              </div>


              <div className="form-group">

                <label htmlFor="institutionalEmail">
                  Institutional Email
                </label>

                <input
                  type="email"
                  id="institutionalEmail"
                  name="institutionalEmail"
                  placeholder="Enter institutional email"
                  required
                />

                <small>
                  Use the official email address of the hospital or clinic.
                </small>

              </div>


              <div className="form-group">

                <label htmlFor="hospitalAddress">
                  Address
                </label>

                <input
                  type="text"
                  id="hospitalAddress"
                  name="hospitalAddress"
                  placeholder="Enter hospital or clinic address"
                  required
                />

              </div>


              <div className="form-group">

                <label htmlFor="hospitalPhone">
                  Phone Number
                </label>

                <div className="phone-input">

                  <select
                    id="hospitalCountryCode"
                    name="hospitalCountryCode"
                    required
                  >

                    <option value="+251">
                      Ethiopia (+251)
                    </option>

                    <option value="+254">
                      Kenya (+254)
                    </option>

                    <option value="+255">
                      Tanzania (+255)
                    </option>

                    <option value="+256">
                      Uganda (+256)
                    </option>

                    <option value="+20">
                      Egypt (+20)
                    </option>

                    <option value="+27">
                      South Africa (+27)
                    </option>

                    <option value="+44">
                      United Kingdom (+44)
                    </option>

                    <option value="+1">
                      United States (+1)
                    </option>

                    <option value="+971">
                      UAE (+971)
                    </option>

                    <option value="+966">
                      Saudi Arabia (+966)
                    </option>

                    <option value="+91">
                      India (+91)
                    </option>

                  </select>


                  <input
                    type="tel"
                    id="hospitalPhone"
                    name="hospitalPhone"
                    placeholder="Enter phone number"
                    required
                  />

                </div>

              </div>


              <div className="form-group">

                <label htmlFor="hospitalAdditionalPhone">
                  Additional Phone Number
                </label>

                <div className="phone-input">

                  <select
                    id="hospitalAdditionalCountryCode"
                    name="hospitalAdditionalCountryCode"
                  >

                    <option value="+251">
                      Ethiopia (+251)
                    </option>

                    <option value="+254">
                      Kenya (+254)
                    </option>

                    <option value="+255">
                      Tanzania (+255)
                    </option>

                    <option value="+256">
                      Uganda (+256)
                    </option>

                    <option value="+20">
                      Egypt (+20)
                    </option>

                    <option value="+27">
                      South Africa (+27)
                    </option>

                    <option value="+44">
                      United Kingdom (+44)
                    </option>

                    <option value="+1">
                      United States (+1)
                    </option>

                    <option value="+971">
                      UAE (+971)
                    </option>

                    <option value="+966">
                      Saudi Arabia (+966)
                    </option>

                    <option value="+91">
                      India (+91)
                    </option>

                  </select>


                  <input
                    type="tel"
                    id="hospitalAdditionalPhone"
                    name="hospitalAdditionalPhone"
                    placeholder="Enter additional phone number"
                  />

                </div>

              </div>

            </section>


            {/* HOSPITAL ACCOUNT INFORMATION */}

            <section className="form-section">

              <h2>2. Account Information</h2>


              <div className="form-group">

                <label htmlFor="hospitalPassword">
                  Password
                </label>

                <input
                  type="password"
                  id="hospitalPassword"
                  name="hospitalPassword"
                  value={hospitalPassword}
                  onChange={(e) =>
                    setHospitalPassword(e.target.value)
                  }
                  placeholder="Create a strong password"
                  minLength={8}
                  required
                />

                <small>
                  Use at least 8 characters with uppercase and lowercase
                  letters, numbers, and special characters.
                </small>

                <small>
                  Example: Abcd@1234
                </small>


                {hospitalPassword.length > 0 &&
                  !hospitalPasswordIsStrong && (
                    <small className="password-warning">
                      Your password is not strong enough.
                      Add uppercase letters, lowercase letters,
                      numbers, and a special character.
                    </small>
                  )}


                {hospitalPasswordIsStrong && (
                  <small className="password-success">
                    Strong password.
                  </small>
                )}

              </div>


              <div className="form-group">

                <label htmlFor="hospitalConfirmPassword">
                  Confirm Password
                </label>

                <input
                  type="password"
                  id="hospitalConfirmPassword"
                  name="hospitalConfirmPassword"
                  value={hospitalConfirmPassword}
                  onChange={(e) =>
                    setHospitalConfirmPassword(e.target.value)
                  }
                  placeholder="Confirm your password"
                  required
                />


                {hospitalConfirmPassword.length > 0 &&
                  !hospitalPasswordsMatch && (
                    <small className="password-warning">
                      Passwords do not match.
                    </small>
                  )}


                {hospitalPasswordsMatch && (
                  <small className="password-success">
                    Passwords match.
                  </small>
                )}

              </div>

            </section>


            {/* HOSPITAL VERIFICATION */}

            <section className="verification-notice">

              <h2>Hospital / Clinic Verification</h2>

              <p>
                Submitting this form does not immediately activate
                the hospital or clinic account.
              </p>

              <p>
                The institution must first be reviewed and verified
                by an authorized MEKAKEL administrator.
              </p>

            </section>


            {/* SUBMIT */}

            <button
              type="submit"
              className="register-button"
              disabled={
                !hospitalPasswordIsStrong ||
                !hospitalPasswordsMatch
              }
            >
              Submit Hospital / Clinic Registration
            </button>


            <button
              type="button"
              className="back-button"
              onClick={() => setRegistrationType('')}
            >
              Back
            </button>


            <p className="login-link">

              Already have an account?{' '}

              <Link to="/login">
                Login
              </Link>

            </p>

          </form>

        </div>

      </main>
    )
  }

 return null
}
export default Register