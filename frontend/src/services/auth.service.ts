import apiRequest from './api'

// ACCOUNT TYPES

export type AccountType = 'INDIVIDUAL' | 'HOSPITAL'

export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'

export type ReportType = 'IMAGE' | 'PDF'

export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

// USER TYPES

export interface AuthUser {
  id: number
  name: string
  email: string
  accountType: AccountType
  role: string
  isActive?: boolean
}

// LOGIN TYPES

export interface LoginData {
  email: string
  password: string
  accountType: AccountType
}

export interface LoginResponse {
  message: string
  token: string
  user: AuthUser
}

// AVAILABILITY TYPES

export interface AvailabilityData {
  day: Weekday
  time: string
}

// REGISTRATION TYPES

export interface RegisterData {
  email: string
  password: string
  name: string
  accountType: AccountType

  // Mock Fayda identity fields
  faydaId?: string
  dateOfBirth?: string

  // Contact information
  phone?: string
  additionalPhone?: string
  address?: string

  // Donor details
  age?: number
  weight?: number
  height?: number

  currentAvailability?: AvailabilityStatus
  lastDonation?: string
  availabilities?: AvailabilityData[]

  // Medical report
  reportType?: ReportType
  medicalReport?: File
  medicalReportConsent?: boolean

  // Hospital details
  hospitalName?: string
}

export interface RegisterResponse {
  message: string
  user: AuthUser
}

// LOGIN

export async function login(
  data: LoginData
): Promise<LoginResponse> {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      accountType: data.accountType,
    }),
  })

  return response as LoginResponse
}

// REGISTER

export async function register(
  data: RegisterData
): Promise<RegisterResponse> {
  const {
    availabilities,
    medicalReport,
    ...fields
  } = data

  const formData = new FormData()

  // Append registration fields
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })

  // Append donor availability
  if (availabilities !== undefined) {
    formData.append(
      'availabilities',
      JSON.stringify(availabilities)
    )
  }

  // Append medical report
  if (medicalReport) {
    formData.append('medicalReport', medicalReport)
  }

  // Submit registration
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: formData,
  })

  return response as RegisterResponse
}