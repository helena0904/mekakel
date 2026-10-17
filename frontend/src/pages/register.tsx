import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { login, register } from '../services/auth.service'
import { verifyFayda } from '../services/fayda.service'
import { useAuth } from '../hooks/useAuth'
import { dashboardPathForUser } from '../utils/dashboard'


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

const MAX_REPORT_SIZE = 5 * 1024 * 1024

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
  const { loginUser, user, token } = useAuth()

  const [registrationType, setRegistrationType] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)
  const [medicalWarning, setMedicalWarning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [faydaId, setFaydaId] = useState('')
  const [fullName, setFullName] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [faydaVerified, setFaydaVerified] = useState(false)
  const [isVerifyingFayda, setIsVerifyingFayda] = useState(false)
  const [faydaMessage, setFaydaMessage] = useState('')
  const [faydaMessageType, setFaydaMessageType] = useState<
    'success' | 'error' | ''
  >('')

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
  const [medicalReportConsent, setMedicalReportConsent] = useState(false)
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

  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()

  const dateOfBirth = useMemo(() => {
    if (!/^\d{4}$/.test(dobYear)) return ''
    if (!/^\d{1,2}$/.test(dobMonth) || !/^\d{1,2}$/.test(dobDay)) return ''

    const year = Number(dobYear)
    const month = Number(dobMonth)
    const day = Number(dobDay)

    if (month < 1 || month > 12 || day < 1 || day > 31) return ''

    const date = new Date(Date.UTC(year, month - 1, day))

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return ''
    }

    const paddedMonth = String(month).padStart(2, '0')
    const paddedDay = String(day).padStart(2, '0')

    return `${dobYear}-${paddedMonth}-${paddedDay}`
  }, [dobDay, dobMonth, dobYear])

  const calculateAge = (isoDate: string): number => {
    const [year, month, day] = isoDate.split('-').map(Number)
    const now = new Date()
    let years = now.getFullYear() - year
    if (
      now.getMonth() + 1 < month ||
      (now.getMonth() + 1 === month && now.getDate() < day)
    ) {
      years--
    }
    return years
  }

  const resetFaydaVerification = () => {
    setFaydaVerified(false)
    setFaydaMessage('')
    setFaydaMessageType('')
  }

  const updateDateOfBirth = (
    field: 'day' | 'month' | 'year',
    value: string,
  ) => {
    const digits = value.replace(/\D/g, '')
    const limited =
      field === 'year' ? digits.slice(0, 4) : digits.slice(0, 2)

    if (field === 'day') setDobDay(limited)
    else if (field === 'month') setDobMonth(limited)
    else setDobYear(limited)

    resetFaydaVerification()
  }

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
    value: Availability[K],
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

  const handleFaydaVerification = async () => {
    setFaydaMessage('')
    setFaydaMessageType('')
    setFaydaVerified(false)

    if (!/^\d{16}$/.test(faydaId.trim())) {
      setFaydaMessage('Fayda ID must contain exactly 16 digits.')
      setFaydaMessageType('error')
      return
    }

    if (!fullName.trim()) {
      setFaydaMessage('Please enter your full name.')
      setFaydaMessageType('error')
      return
    }

    if (!dobYear && !dobMonth && !dobDay) {
      setFaydaMessage('Please enter your date of birth.')
      setFaydaMessageType('error')
      return
    }

    if (!dateOfBirth) {
      setFaydaMessage('Please enter a valid date of birth.')
      setFaydaMessageType('error')
      return
    }

    if (dateOfBirth > today) {
      setFaydaMessage('Date of birth cannot be in the future.')
      setFaydaMessageType('error')
      return
    }

    setIsVerifyingFayda(true)

    try {
      const result = await verifyFayda({
        faydaId: faydaId.trim(),
        fullName: fullName.trim(),
        dateOfBirth,
      })

      if (result.success && result.simulated === true) {
        setFaydaVerified(true)
        setFaydaMessage(
          'Simulated Fayda check passed. This does not verify an official identity.',
        )
        setFaydaMessageType('success')
      } else {
        setFaydaMessage(result.message)
        setFaydaMessageType('error')
      }
    } catch (error) {
      setFaydaMessage(
        error instanceof Error
          ? error.message
          : 'Verification failed. Please try again.',
      )
      setFaydaMessageType('error')
    } finally {
      setIsVerifyingFayda(false)
    }
  }

  const handleDonorSubmit = async (
    e: FormEvent<HTMLFormElement>,
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
        'Please select at least one available day and choose a time for it.',
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

    if (!dateOfBirth || dateOfBirth > today) {
      setError('Please enter a valid date of birth that is not in the future.')
      return
    }

    if (!faydaVerified) {
      setError('Please verify your identity before registering.')
      return
    }

    const calculatedAge = calculateAge(dateOfBirth)
    if (calculatedAge < 18 || Number(age) !== calculatedAge) {
      setError('Age must be at least 18 and match your date of birth.')
      return
    }

    if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) {
      setError('Weight must be greater than zero.')
      return
    }

    if (!Number.isFinite(Number(height)) || Number(height) <= 0) {
      setError('Height must be greater than zero.')
      return
    }

    if (!medicalReportConsent) {
      setError('Please consent to submitting your medical report.')
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

    if (
      reportType === 'IMAGE' &&
      !['image/jpeg', 'image/png', 'image/webp'].includes(medicalReport.type)
    ) {
      setError('Please upload a valid image file.')
      return
    }

    if (
      reportType === 'PDF' &&
      medicalReport.type !== 'application/pdf'
    ) {
      setError('Please upload a valid PDF file.')
      return
    }

    setIsSubmitting(true)

    try {
      const donorEmail = email.trim()

      await register({
        email: donorEmail,
        password,
        name: fullName.trim(),
        accountType: 'INDIVIDUAL',
        faydaId: faydaId.trim(),
        dateOfBirth,
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

      // Registration has already succeeded. If automatic sign-in fails,
      // send the donor to login instead of asking them to register again.
      try {
        const response = await login({
          email: donorEmail,
          password,
          accountType: 'INDIVIDUAL',
        })
        loginUser(response.token, response.user)
        navigate(dashboardPathForUser(response.user), { replace: true })
      } catch {
        navigate('/login', {
          replace: true,
          state: { registrationSuccess: true },
        })
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleHospitalSubmit = async (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

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
      const hospitalEmail = institutionalEmail.trim()

      await register({
        email: hospitalEmail,
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

      // Registration succeeded. Sign the hospital in and send it to its
      // dashboard. If automatic sign-in fails, fall back to the login page.
      try {
        const response = await login({
          email: hospitalEmail,
          password: hospitalPassword,
          accountType: 'HOSPITAL',
        })
        loginUser(response.token, response.user)
        navigate(dashboardPathForUser(response.user), { replace: true })
      } catch {
        navigate('/login', {
          replace: true,
          state: { registrationSuccess: true },
        })
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // An already signed-in user should never see the registration page; send
  // them straight to the dashboard that matches their account type.
  if (user && token) {
    return (
      <Navigate
        to={dashboardPathForUser(user)}
        replace
      />
    )
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

            {successMessage && (
              <div className="register-success">{successMessage}</div>
            )}

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
                Your hospital or clinic registration will be reviewed by
                a MEKAKEL administrator.
              </p>

              <p>
                You will be signed in and taken to your hospital
                dashboard. Inventory and staff management unlock once
                your facility is approved.
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
                onChange={(e) => {
                  setFaydaId(
                    e.target.value.replace(/\D/g, '').slice(0, 16),
                  )
                  setFaydaVerified(false)
                  setFaydaMessage('')
                  setFaydaMessageType('')
                }}
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
                Fayda verification is simulated for this MVP. This is not
                a connection to the official Fayda system.
              </small>
            </div>

            <div className="fayda-notice">
              <p>
                Enter your details and select Verify Identity before
                submitting your donor registration.
              </p>

              <details>
                <summary>Test identities for this demo</summary>
                <p>
                  The simulated check only succeeds for these records.
                  Use the exact ID, full name and date of birth:
                </p>
                <ul>
                  <li>
                    9999000000000001 &middot; Abebe Kebede &middot;
                    2000-05-15
                  </li>
                  <li>
                    9999000000000002 &middot; Hana Tesfaye &middot;
                    1998-09-20
                  </li>
                  <li>
                    9999000000000003 &middot; Mekdes Alemu &middot;
                    2002-04-11
                  </li>
                  <li>
                    9999000000000004 &middot; Dawit Bekele &middot;
                    1995-12-03
                  </li>
                </ul>
              </details>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>

              <input
                type="text"
                id="fullName"
                name="fullName"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  setFaydaVerified(false)
                  setFaydaMessage('')
                  setFaydaMessageType('')
                }}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="dobDay">Date of Birth</label>

              <div className="dob-input">
                <input
                  type="number"
                  id="dobDay"
                  name="dobDay"
                  value={dobDay}
                  onChange={(e) =>
                    updateDateOfBirth('day', e.target.value)
                  }
                  min="1"
                  max="31"
                  inputMode="numeric"
                  placeholder="DD"
                  required
                />

                <input
                  type="number"
                  id="dobMonth"
                  name="dobMonth"
                  value={dobMonth}
                  onChange={(e) =>
                    updateDateOfBirth('month', e.target.value)
                  }
                  min="1"
                  max="12"
                  inputMode="numeric"
                  placeholder="MM"
                  required
                />

                <input
                  type="number"
                  id="dobYear"
                  name="dobYear"
                  value={dobYear}
                  onChange={(e) =>
                    updateDateOfBirth('year', e.target.value)
                  }
                  min="1900"
                  max={currentYear}
                  inputMode="numeric"
                  placeholder="YYYY"
                  required
                />
              </div>

              <small>
                Enter the day, month, and year as numbers, for example
                15 / 05 / 2000.
              </small>
            </div>

            <div className="fayda-verification">
              <button
                type="button"
                className="register-button"
                onClick={handleFaydaVerification}
                disabled={isVerifyingFayda || faydaVerified}
              >
                {isVerifyingFayda
                  ? 'Verifying...'
                  : faydaVerified
                    ? 'Identity Verified'
                    : 'Verify Identity'}
              </button>

              {faydaMessage && (
                <p
                  role="status"
                  className={
                    faydaMessageType === 'success'
                      ? 'password-success'
                      : 'password-warning'
                  }
                >
                  {faydaMessage}
                </p>
              )}

              {faydaVerified && (
                <small>
                  Mock Fayda checks your input format only; it does not
                  confirm the identity against an official registry.
                </small>
              )}
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
                          e.target.checked,
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
                    e.target.value as AvailabilityStatus | '',
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
                      ? 'image/jpeg,image/png,image/webp'
                      : '.pdf,application/pdf'
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setMedicalReport(file)

                    if (file && file.size > MAX_REPORT_SIZE) {
                      setError('Medical report must be 5 MB or smaller.')
                    } else if (file) {
                      setError('')
                    }
                  }}
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

            <label className="warning-checkbox">
              <input
                type="checkbox"
                checked={medicalReportConsent}
                onChange={(e) => setMedicalReportConsent(e.target.checked)}
                required
              />
              <span>
                I consent to submitting my medical report for review by
                authorized healthcare verifiers in Mekakel.
              </span>
            </label>
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
                max={new Date().toISOString().split('T')[0]}
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
              !availabilityIsValid ||
              !faydaVerified ||
              !medicalReportConsent
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