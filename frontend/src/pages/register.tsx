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


  /*  1. CHOOSE REGISTRATION TYPE */

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


  /* 2. BEFORE YOU REGISTER - INDIVIDUAL DONOR */

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


  /* 3. HOSPITAL / CLINIC REGISTRATION*/

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





 /*  4. INDIVIDUAL DONOR REGISTRATION */

  return (
    <main className="register-page">

      <div className="register-container">

        <h1>Individual Donor Registration</h1>

        <p className="register-introduction">
          Register with MEKAKEL as an individual volunteer donor.
          Your information and medical report will be reviewed before
          you become a Verified Active Donor.
        </p>


        <form className="register-form">


          {/* 1. IDENTITY INFORMATION */}

          <section className="form-section">

            <h2>1. Identity Information</h2>


            <div className="form-group">

              <label htmlFor="faydaId">
                Fayda ID
              </label>

              <input
                type="text"
                id="faydaId"
                name="faydaId"
                placeholder="Enter your Fayda ID"
                required
              />

              <small>
                Fayda verification is currently simulated for this MVP.
                Actual Fayda integration will be added in a future version.
              </small>

            </div>


            <div className="fayda-notice">

              <p>
                Your identity will be checked through the MEKAKEL
                mock Fayda verification process.
              </p>

            </div>


            <div className="form-group">

              <label htmlFor="fullName">
                Full Name
              </label>

              <input
                type="text"
                id="fullName"
                name="fullName"
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value.toUpperCase())
                }
                placeholder="Enter your full name"
                required
              />

            </div>


            <div className="form-group">

              <label htmlFor="email">
                Email
              </label>

              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email"
                required
              />

            </div>


            <div className="form-group">

              <label htmlFor="phone">
                Primary Phone Number
              </label>

              <div className="phone-input">

                <select
                  id="countryCode"
                  name="countryCode"
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
                  id="phone"
                  name="phone"
                  placeholder="Enter phone number"
                  required
                />
</div>

            </div>


            <div className="form-group">

              <label htmlFor="additionalPhone">
                Additional Phone Number
              </label>

              <div className="phone-input">

                <select
                  id="additionalCountryCode"
                  name="additionalCountryCode"
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
                  id="additionalPhone"
                  name="additionalPhone"
                  placeholder="Enter additional phone number"
                />

              </div>

            </div>


            <div className="form-group">

              <label htmlFor="address">
                Address
              </label>

              <input
                type="text"
                id="address"
                name="address"
                placeholder="Enter your address"
                required
              />

            </div>

          </section>


          {/* 2. ACCOUNT INFORMATION */}

          <section className="form-section">

            <h2>2. Account Information</h2>


            <div className="form-group">

              <label htmlFor="password">
                Password
              </label>

              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
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


              {password.length > 0 && !passwordIsStrong && (
                <small className="password-warning">
                  Your password is not strong enough.
                  Add uppercase letters, lowercase letters,
                  numbers, and a special character.
                </small>
              )}


              {passwordIsStrong && (
                <small className="password-success">
                  Strong password.
                </small>
              )}

            </div>


            <div className="form-group">

              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Confirm your password"
                required
              />
 {confirmPassword.length > 0 && !passwordsMatch && (
                <small className="password-warning">
                  Passwords do not match.
                </small>
              )}


              {passwordsMatch && (
                <small className="password-success">
                  Passwords match.
                </small>
              )}

            </div>

          </section>


          {/* 3. PHYSICAL INFORMATION */}

          <section className="form-section">

            <h2>3. Physical Information</h2>


            <div className="form-group">

              <label htmlFor="age">
                Age
              </label>

              <input
                type="number"
                id="age"
                name="age"
                min="1"
                placeholder="Enter your age"
                required
              />

            </div>


            <div className="form-group">

              <label htmlFor="weight">
                Weight (kg)
              </label>

              <input
                type="number"
                id="weight"
                name="weight"
                min="1"
                step="0.1"
                placeholder="Enter your weight"
                required
              />

            </div>


            <div className="form-group">

              <label htmlFor="height">
                Height (cm)
              </label>

              <input
                type="number"
                id="height"
                name="height"
                min="1"
                step="0.1"
                placeholder="Enter your height"
                required
              />

            </div>

          </section>


          {/* 4. DONATION AVAILABILITY */}

          <section className="form-section">

            <h2>4. Donation Availability</h2>


            <div className="form-group">

              <label htmlFor="availabilityDate">
                Available Date
              </label>

              <input
                type="date"
                id="availabilityDate"
                name="availabilityDate"
                required
              />

              <small>
                Select the year, month, and day you are available.
              </small>

            </div>


            <div className="form-group">

              <label htmlFor="availabilityPeriod">
                Available Period
              </label>

              <select
                id="availabilityPeriod"
                name="availabilityPeriod"
                required
              >

                <option value="">
                  Select period
                </option>

                <option value="morning">
                  Morning
                </option>

                <option value="afternoon">
                  Afternoon
                </option>

                <option value="evening">
                  Evening
                </option>

              </select>

            </div>


            <div className="form-group">

              <label htmlFor="availabilityHour">
                Available Hour
              </label>

              <input
                type="time"
                id="availabilityHour"
                name="availabilityHour"
                required
              />

            </div>


            <div className="form-group">

              <label htmlFor="currentAvailability">
                Current Availability
              </label>

              <select
                id="currentAvailability"
                name="currentAvailability"
                required
              >

                <option value="">
                  Select availability
                </option>

                <option value="available">
                  Available to Donate
                </option>

                <option value="unavailable">
                  Currently Unavailable
                </option>

              </select>

            </div>

          </section>
{/* 5. MEDICAL REPORT */}

          <section className="form-section">

            <h2>5. Medical Report</h2>


            <p className="section-description">
              Upload a valid medical screening report issued by
              an authorized medical facility.
            </p>


            <div className="medical-requirements">

              <h3>The report must show:</h3>

              <ul>

                <li>Negative HIV result</li>

                <li>Negative Hepatitis B result</li>

                <li>Negative Hepatitis C result</li>

                <li>Negative Syphilis result</li>

                <li>Confirmed ABO and Rh blood type</li>

                <li>Testing facility name</li>

                <li>Test date</li>

              </ul>

            </div>


            <div className="form-group">

              <label htmlFor="reportType">
                Choose Report File Type
              </label>

              <select
                id="reportType"
                name="reportType"
                value={reportType}
                onChange={(e) =>
                  setReportType(e.target.value)
                }
                required
              >

                <option value="">
                  Select file type
                </option>

                <option value="image">
                  Image
                </option>

                <option value="pdf">
                  PDF
                </option>

              </select>

            </div>


            {reportType && (

              <div className="form-group">

                <label htmlFor="medicalReport">
                  Upload Medical Report
                </label>

                <input
                  type="file"
                  id="medicalReport"
                  name="medicalReport"
                  accept={
                    reportType === 'image'
                      ? 'image/*'
                      : '.pdf,application/pdf'
                  }
                  required
                />

                <small>
                  {reportType === 'image'
                    ? 'Only image files are accepted.'
                    : 'Only PDF files are accepted.'
                  }
                </small>

              </div>

            )}


            <div className="medical-note">

              <p>
                MEKAKEL does not perform laboratory testing.
                Your medical report will be reviewed by an authorized
                Doctor/Verifier.
              </p>

            </div>

          </section>


          {/* 6. DONATION HISTORY */}

          <section className="form-section">

            <h2>6. Donation History</h2>


            <div className="form-group">

              <label htmlFor="lastDonation">
                Last Donation Date
              </label>

              <input
                type="date"
                id="lastDonation"
                name="lastDonation"
              />

              <small>
                Leave this empty if you have never donated blood.
              </small>

            </div>

          </section>


          {/* 7. VERIFICATION PROCESS */}

          <section className="verification-notice">

            <h2>7. Verification Process</h2>

            <p>
              Submitting this form does not immediately make you
              a Verified Active Donor.
            </p>

            <p>
              Your identity, information, and medical report must
              first be reviewed by an authorized Doctor/Verifier.
            </p>
<p>
              The next eligible donation date will be calculated
              automatically by the system based on your last donation
              date and the configured eligibility rules.
            </p>

            <p>
              Your medical information will only be accessible to
              authorized personnel according to their role and permissions.
            </p>

          </section>


          {/* SUBMIT */}

          <button
            type="submit"
            className="register-button"
            disabled={
              !passwordIsStrong ||
              !passwordsMatch
            }
          >
            Submit Donor Registration
          </button>


          <button
            type="button"
            className="back-button"
            onClick={() => {
              setShowRegistration(false)
              setMedicalWarning(false)
            }}
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
export default Register