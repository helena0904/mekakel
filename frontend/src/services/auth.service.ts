import apiRequest from './api'

export interface LoginData {
  email: string
  password: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

export interface AvailabilityData {
  day:
    | 'MONDAY'
    | 'TUESDAY'
    | 'WEDNESDAY'
    | 'THURSDAY'
    | 'FRIDAY'
    | 'SATURDAY'
    | 'SUNDAY'
  time: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'

  faydaId?: string
  phone?: string
  additionalPhone?: string
  address?: string

  age?: number
  weight?: number
  height?: number

  currentAvailability?: 'AVAILABLE' | 'UNAVAILABLE'

  lastDonation?: string

  availabilities?: AvailabilityData[]

  reportType?: 'IMAGE' | 'PDF'
  medicalReport?: File

  hospitalName?: string
}

export async function login(data: LoginData) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function register(data: RegisterData) {
  const { availabilities, medicalReport, ...fields } = data
  const formData = new FormData()

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) formData.append(key, String(value))
  })

  if (availabilities) {
    formData.append('availabilities', JSON.stringify(availabilities))
  }

  if (medicalReport) formData.append('medicalReport', medicalReport)

  return apiRequest('/auth/register', {
    method: 'POST',
    body: formData,
  })
}