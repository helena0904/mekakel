import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/auth.service'

type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'
type ReportType = 'IMAGE' | 'PDF'

const MAX_REPORT_SIZE = 5 * 1024 * 1024 // 5 MB, keep in sync with the backend

type Availability = {
  enabled: boolean
  time: string
}

const countryCodes = [
  { value: '+251', label: 'Ethiopia (+251)' },
  { value: '+254', label: 'Kenya (+254)' },
  { value: '+255', label: 'Tanzania (+255)' },
  { value: '+256', label: 'Uganda (+256)' },
  { value: '+20', label: 'Egypt (+20)' },
  { value: '+27', label: 'South Africa (+27)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+1', label: 'United States (+1)' },
  { value: '+971', label: 'UAE (+971)' },
  { value: '+966', label: 'Saudi Arabia (+966)' },
  { value: '+91', label: 'India (+91)' },
]

const weekdays: [Weekday, string][] = [
  ['MONDAY', 'Monday'],
  ['TUESDAY', 'Tuesday'],
  ['WEDNESDAY', 'Wednesday'],
  ['THURSDAY', 'Thursday'],
  ['FRIDAY', 'Friday'],
  ['SATURDAY', 'Saturday'],
  ['SUNDAY', 'Sunday'],
]

const emptyAvailability: Record<Weekday, Availability> = {
  MONDAY: { enabled: false, time: '' },
  TUESDAY: { enabled: false, time: '' },
  WEDNESDAY: { enabled: false, time: '' },
  THURSDAY: { enabled: false, time: '' },
  FRIDAY: { enabled: false, time: '' },
  SATURDAY: { enabled: false, time: '' },
  SUNDAY: { enabled: false, time: '' },
}

function Register() {
  const navigate = useNavigate()

  const [registrationType, setRegistrationType] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)
  const [medicalWarning, setMedicalWarning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [faydaId, setFaydaId] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+251')
  const [additionalPhone, setAdditionalPhone] = useState('')
  const [additionalCountryCode, setAdditionalCountryCode] =
    useState('+251')
  const [address, setAddress] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  const [availability, setAvailability] =
    useState<Record<Weekday, Availability>>(emptyAvailability)

  const [currentAvailability, setCurrentAvailability] =
    useState<AvailabilityStatus | ''>('')
  const [reportType, setReportType] = useState<ReportType | ''>('')
  const [medicalReport, setMedicalReport] = useState<File | null>(null)
  const [lastDonation, setLastDonation] = useState('')

  const [hospitalName, setHospitalName] = useState('')
  const [institutionalEmail, setInstitutionalEmail] = useState('')
  const [hospitalAddress, setHospitalAddress] = useState('')
  const [hospitalPhone, setHospitalPhone] = useState('')
  const [hospitalCountryCode, setHospitalCountryCode] = useState('+251')
  const [hospitalAdditionalPhone, setHospitalAdditionalPhone] =
    useState('')
  const [hospitalAdditionalCountryCode, setHospitalAdditionalCountryCode] =
    useState('+251')

  const [hospitalPassword, setHospitalPassword] = useState('')
  const [hospitalConfirmPassword, setHospitalConfirmPassword] =
    useState('')

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

  const updateAvailability = <K extends keyof Availability>(
    day: Weekday,
    field: K,
    value: Availability[K]
  ) => {
    setAvailability((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        [field]: value,
      },
    }))
  }

  const selectedAvailability = Object.entries(availability)
    .filter(([, value]) => value.enabled)
    .map(([day, value]) => ({
      day: day as Weekday,
      time: value.time,
    }))

  const availabilityIsValid =
    selectedAvailability.length > 0 &&
    selectedAvailability.every((item) => item.time.trim().length > 0)

  const handleDonorSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    setError('')

    if (!passwordIsStrong) {
      setError('Please create a strong password.')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    if (!availabilityIsValid) {
      setError(
        'Please select at least one available day and choose a time for it.'
      )
      return
    }

    if (!currentAvailability) {
      setError('Please select your current availability.')
      return
    }

    if (!/^\d{16}$/.test(faydaId.trim())) {
      setError('Fayda ID must be exactly 16 digits.')
      return
    }

    if (!Number.isInteger(Number(age)) || Number(age) < 18) {
      setError('You must be at least 18 years old to register as a donor.')
      return
    }

    if (Number(weight) <= 0 || Number(height) <= 0) {
      setError('Weight and height must be greater than zero.')
      return
    }

    if (!reportType || !medicalReport) {
      setError('Please select your medical report file.')
      return
    }

    if (medicalReport.size > MAX_REPORT_SIZE) {
      setError('Medical report must be 5 MB or smaller.')
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        email: email.trim(),
        password,
        name: fullName.trim(),
        accountType: 'INDIVIDUAL',
        faydaId: faydaId.trim(),
        phone: `${countryCode}${phone.trim()}`,
        additionalPhone: additionalPhone.trim()
          ? `${additionalCountryCode}${additionalPhone.trim()}`
          : undefined,
        address: address.trim(),
        age: Number(age),
        weight: Number(weight),
        height: Number(height),
        currentAvailability,
        lastDonation: lastDonation || undefined,
        availabilities: selectedAvailability,
        reportType,
        medicalReport,
      })

      navigate('/login')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Registration failed.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleHospitalSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    setError('')

    if (!hospitalPasswordIsStrong) {
      setError('Please create a strong password.')
      return
    }

    if (!hospitalPasswordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        email: institutionalEmail.trim(),
        password: hospitalPassword,
        name: hospitalName.trim(),
        accountType: 'HOSPITAL',
        hospitalName: hospitalName.trim(),
        address: hospitalAddress.trim(),
        phone: `${hospitalCountryCode}${hospitalPhone.trim()}`,
        additionalPhone: hospitalAdditionalPhone.trim()
          ? `${hospitalAdditionalCountryCode}${hospitalAdditionalPhone.trim()}`
          : undefined,
      })

      navigate('/login')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Registration failed.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

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
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </main>
    )
  }

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
              Blood donation eligibility must be determined by qualified
              medical personnel. The following conditions may affect
              eligibility and should be discussed with a medical professional:
            </p>

            <ul>
              <li>HIV</li>
              <li>Hepatitis B</li>
              <li>Hepatitis C</li>
              <li>Syphilis</li>
              <li>Other transfusion-transmissible infections</li>
              <li>Low hemoglobin or anemia</li>
              <li>Pregnancy or recent childbirth</li>
              <li>Current illness or infection</li>
              <li>Low body weight</li>
              <li>Unstable blood pressure or vital signs</li>
              <li>Recent blood donation</li>
              <li>Certain medical conditions or medications</li>
              <li>Recent surgery or medical procedures</li>
            </ul>

            <div className="do-not-register">
              <h3>Important</h3>
              <p>
                Do not rely on this list to determine your eligibility.
                An authorized medical professional must assess your suitability
                to donate blood.
              </p>
            </div>

            <div className="medical-information-note">
              <h3>Medical Testing and Verification</h3>

              <p>
                MEKAKEL does not perform laboratory testing. Medical testing
                must be performed by an authorized medical facility.
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
                onChange={(e) => setMedicalWarning(e.target.checked)}
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

  if (registrationType === 'hospital') {
    return (
      <main className="register-page">
        <div className="register-container">
          <h1>Hospital / Clinic Registration</h1>

          <p className="register-introduction">
            Register your hospital or clinic with MEKAKEL to coordinate
            blood availability and requests with other healthcare facilities.
          </p>

          <form className="register-form" onSubmit={handleHospitalSubmit}>
            {error && <div className="register-error">{error}</div>}

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
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
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
                  value={institutionalEmail}
                  onChange={(e) => setInstitutionalEmail(e.target.value)}
                  placeholder="Enter institutional email"
                  required
                />

                <small>
                  Use the official email address of the hospital or clinic.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="hospitalAddress">Address</label>

                <input
                  type="text"
                  id="hospitalAddress"
                  name="hospitalAddress"
                  value={hospitalAddress}
                  onChange={(e) => setHospitalAddress(e.target.value)}
                  placeholder="Enter hospital or clinic address"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="hospitalPhone">Phone Number</label>

                <div className="phone-input">
                  <select
                    id="hospitalCountryCode"
                    name="hospitalCountryCode"
                    value={hospitalCountryCode}
                    onChange={(e) => setHospitalCountryCode(e.target.value)}
                    required
                  >
                    {countryCodes.map((country) => (
                      <option key={country.value} value={country.value}>
                        {country.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    id="hospitalPhone"
                    name="hospitalPhone"
                    value={hospitalPhone}
                    onChange={(e) => setHospitalPhone(e.target.value)}
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
                    value={hospitalAdditionalCountryCode}
                    onChange={(e) =>
                      setHospitalAdditionalCountryCode(e.target.value)
                    }
                  >
                    {countryCodes.map((country) => (
                      <option key={country.value} value={country.value}>
                        {country.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    id="hospitalAdditionalPhone"
                    name="hospitalAdditionalPhone"
                    value={hospitalAdditionalPhone}
                    onChange={(e) =>
                      setHospitalAdditionalPhone(e.target.value)
                    }
                    placeholder="Enter additional phone number"
                  />
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>2. Account Information</h2>

              <div className="form-group">
                <label htmlFor="hospitalPassword">Password</label>

                <input
                  type="password"
                  id="hospitalPassword"
                  name="hospitalPassword"
                  value={hospitalPassword}
                  onChange={(e) => setHospitalPassword(e.target.value)}
                  placeholder="Create a strong password"
                  minLength={8}
                  required
                />

                <small>
                  Use at least 8 characters with uppercase and lowercase
                  letters, numbers, and special characters.
                </small>

                {hospitalPassword.length > 0 &&
                  !hospitalPasswordIsStrong && (
                    <small className="password-warning">
                      Your password is not strong enough. Add uppercase
                      letters, lowercase letters, numbers, and a special
                      character.
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

            <section className="verification-notice">
              <h2>Hospital / Clinic Verification</h2>

              <p>
                Submitting this form does not immediately activate the
                hospital or clinic account.
              </p>

              <p>
                The institution must first be reviewed and verified by an
                authorized MEKAKEL administrator.
              </p>
            </section>

            <button
              type="submit"
              className="register-button"
              disabled={
                isSubmitting ||
                !hospitalPasswordIsStrong ||
                !hospitalPasswordsMatch
              }
            >
              {isSubmitting
                ? 'Creating Account...'
                : 'Submit Hospital / Clinic Registration'}
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() => {
                setRegistrationType('')
                setError('')
              }}
            >
              Back
            </button>

            <p className="login-link">
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="register-page">
      <div className="register-container">
        <h1>Individual Donor Registration</h1>

        <p className="register-introduction">
          Register with MEKAKEL as an individual volunteer donor. Your
          information and medical report will be reviewed before you become
          a Verified Active Donor.
        </p>

        <form className="register-form" onSubmit={handleDonorSubmit}>
          {error && <div className="register-error">{error}</div>}

          <section className="form-section">
            <h2>1. Identity Information</h2>

            <div className="form-group">
              <label htmlFor="faydaId">Fayda ID</label>

              <input
                type="text"
                id="faydaId"
                name="faydaId"
                value={faydaId}
                onChange={(e) =>
                  setFaydaId(e.target.value.replace(/\D/g, '').slice(0, 16))
                }
                inputMode="numeric"
                minLength={16}
                maxLength={16}
                pattern="\d{16}"
                title="Fayda ID must be exactly 16 digits"
                placeholder="Enter your 16-digit Fayda ID"
                required
              />

              <small>Your Fayda ID must be exactly 16 digits.</small>

              <small>
                Fayda verification is currently simulated for this MVP.
                Actual Fayda integration will be added in a future version.
              </small>
            </div>

            <div className="fayda-notice">
              <p>
                Your identity will be checked through the MEKAKEL mock
                Fayda verification process.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>

              <input
                type="text"
                id="fullName"
                name="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>

              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Primary Phone Number</label>

              <div className="phone-input">
                <select
                  id="countryCode"
                  name="countryCode"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  required
                >
                  {countryCodes.map((country) => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  value={additionalCountryCode}
                  onChange={(e) =>
                    setAdditionalCountryCode(e.target.value)
                  }
                >
                  {countryCodes.map((country) => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  id="additionalPhone"
                  name="additionalPhone"
                  value={additionalPhone}
                  onChange={(e) => setAdditionalPhone(e.target.value)}
                  placeholder="Enter additional phone number"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address">Address</label>

              <input
                type="text"
                id="address"
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your address"
                required
              />
            </div>
          </section>

          <section className="form-section">
            <h2>2. Account Information</h2>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                minLength={8}
                required
              />

              <small>
                Use at least 8 characters with uppercase and lowercase
                letters, numbers, and special characters.
              </small>

              {password.length > 0 && !passwordIsStrong && (
                <small className="password-warning">
                  Your password is not strong enough. Add uppercase letters,
                  lowercase letters, numbers, and a special character.
                </small>
              )}

              {passwordIsStrong && (
                <small className="password-success">
                  Strong password.
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

          <section className="form-section">
            <h2>3. Physical Information</h2>

            <div className="form-group">
              <label htmlFor="age">Age</label>

              <input
                type="number"
                id="age"
                name="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="18"
                placeholder="Enter your age (18 or older)"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="weight">Weight (kg)</label>

              <input
                type="number"
                id="weight"
                name="weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                min="1"
                step="0.1"
                placeholder="Enter your weight"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="height">Height (cm)</label>

              <input
                type="number"
                id="height"
                name="height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="1"
                step="0.1"
                placeholder="Enter your height"
                required
              />
            </div>
          </section>

          <section className="form-section">
            <h2>4. Donation Availability</h2>

            <p className="section-description">
              Select the days and times when you are normally available
              to donate blood.
            </p>

            <div className="availability-list">
              {weekdays.map(([day, label]) => (
                <div className="availability-row" key={day}>
                  <label>
                    <input
                      type="checkbox"
                      checked={availability[day].enabled}
                      onChange={(e) =>
                        updateAvailability(
                          day,
                          'enabled',
                          e.target.checked
                        )
                      }
                    />

                    <span>{label}</span>
                  </label>

                  <input
                    type="time"
                    value={availability[day].time}
                    disabled={!availability[day].enabled}
                    required={availability[day].enabled}
                    onChange={(e) =>
                      updateAvailability(day, 'time', e.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            <div className="form-group">
              <label htmlFor="currentAvailability">
                Current Availability
              </label>

              <select
                id="currentAvailability"
                name="currentAvailability"
                value={currentAvailability}
                onChange={(e) =>
                  setCurrentAvailability(
                    e.target.value as AvailabilityStatus | ''
                  )
                }
                required
              >
                <option value="">Select availability</option>
                <option value="AVAILABLE">Available to Donate</option>
                <option value="UNAVAILABLE">Currently Unavailable</option>
              </select>
            </div>

            <small>
              Your weekly availability is separate from your current
              availability status. You can be normally available on
              certain days but temporarily unavailable.
            </small>
          </section>

          <section className="form-section">
            <h2>5. Medical Report</h2>

            <p className="section-description">
              Upload a valid medical screening report issued by an
              authorized medical facility.
            </p>

            <div className="medical-requirements">
              <h3>The report must show:</h3>

              <ul>
                <li>HIV screening result</li>
                <li>Hepatitis B screening result</li>
                <li>Hepatitis C screening result</li>
                <li>Syphilis screening result</li>
                <li>Confirmed ABO and Rh blood type</li>
                <li>Testing facility name</li>
                <li>Test date</li>
              </ul>
            </div>

            <div className="form-group">
              <label htmlFor="reportType">Choose Report File Type</label>

              <select
                id="reportType"
                name="reportType"
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value as ReportType | '')
                  setMedicalReport(null)
                }}
                required
              >
                <option value="">Select file type</option>
                <option value="IMAGE">Image</option>
                <option value="PDF">PDF</option>
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
                    reportType === 'IMAGE'
                      ? 'image/*'
                      : '.pdf,application/pdf'
                  }
                  onChange={(e) =>
                    setMedicalReport(e.target.files?.[0] || null)
                  }
                  required
                />

                <small>
                  {reportType === 'IMAGE'
                    ? 'Only image files are accepted.'
                    : 'Only PDF files are accepted.'}
                </small>

                {medicalReport && (
                  <small>{medicalReport.name}</small>
                )}
              </div>
            )}

            <div className="medical-note">
              <p>
                MEKAKEL does not perform laboratory testing. Your medical
                report must be reviewed by an authorized Doctor/Verifier.
              </p>
            </div>
          </section>

          <section className="form-section">
            <h2>6. Donation History</h2>

            <div className="form-group">
              <label htmlFor="lastDonation">Last Donation Date</label>

              <input
                type="date"
                id="lastDonation"
                name="lastDonation"
                value={lastDonation}
                onChange={(e) => setLastDonation(e.target.value)}
              />

              <small>
                Leave this empty if you have never donated blood.
              </small>
            </div>
          </section>

          <section className="verification-notice">
            <h2>7. Verification Process</h2>

            <p>
              Submitting this form does not immediately make you a
              Verified Active Donor.
            </p>

            <p>
              Your identity, information, and medical report must first
              be reviewed by an authorized Doctor/Verifier.
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

          <button
            type="submit"
            className="register-button"
            disabled={
              isSubmitting ||
              !passwordIsStrong ||
              !passwordsMatch ||
              !availabilityIsValid
            }
          >
            {isSubmitting
              ? 'Creating Account...'
              : 'Submit Donor Registration'}
          </button>

          <button
            type="button"
            className="back-button"
            onClick={() => {
              setShowRegistration(false)
              setMedicalWarning(false)
              setError('')
            }}
          >
            Back
          </button>

          <p className="login-link">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </div>
    </main>
  )
}

export default Register