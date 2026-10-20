import apiRequest from './api'

export type BloodType =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'

export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'

export type VerificationStatusValue =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ADDITIONAL_INFO_REQUIRED'

export type ReportType = 'IMAGE' | 'PDF'

export interface DonorAvailability {
  id: number
  day: Weekday
  time: string
}

export type DonorActiveStatusValue = 'ACTIVE' | 'INACTIVE'

export function splitTimeRange(time: string): {
  startTime: string
  endTime: string
} {
  const [startTime = '', endTime = ''] = time.split('-')

  return { startTime, endTime }
}

export interface MedicalReport {
  id: number
  reportType: ReportType
  fileUrl: string
  verificationStatus: VerificationStatusValue
  verifiedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface DonationRecord {
  id: number
  donatedAt: string
  facilityName: string | null
  units: number | null
  notes: string | null
  createdAt: string
}

export interface DonorProfile {
  id: number
  userId: number
  faydaId: string | null
  dateOfBirth: string | null
  phone: string
  additionalPhone: string | null
  address: string
  subcity: string | null
  wereda: string | null
  age: number
  weight: number
  height: number
  bloodType: BloodType | null
  currentAvailability: AvailabilityStatus
  lastDonation: string | null
  donationIntervalDays: number
  verificationStatus: VerificationStatusValue
  verificationNotes: string | null
  verifiedAt: string | null
  activeStatus: DonorActiveStatusValue
  activationNotes: string | null
  consentToContact: boolean
  shareLocation: boolean
  matchingOptOut: boolean
  availabilities: DonorAvailability[]
  medicalReports: MedicalReport[]
  donationHistory: DonationRecord[]
}

export interface EligibilityCheck {
  key: string
  label: string
  passed: boolean
  detail: string
  informational?: boolean
}

export interface EligibilityResult {
  eligible: boolean
  status: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'PENDING_VERIFICATION'
  medicallyApproved: boolean
  nextEligibleDate: string | null
  daysUntilEligible: number | null
  checks: EligibilityCheck[]
}

export interface DonorDashboardStats {
  totalDonations: number
  totalReports: number
  lastDonation: string | null
  nextEligibleDate: string | null
}

export interface DonationActivation {
  active: boolean
  status: DonorActiveStatusValue
  reasons: string[]
  nextEligibleDate: string | null
  daysUntilEligible: number | null
  checks: EligibilityCheck[]
}

export interface DonorDashboardData {
  profile: DonorProfile
  eligibility: EligibilityResult
  activation?: DonationActivation
  stats: DonorDashboardStats
}

export interface UpdateProfileInput {
  phone: string
  additionalPhone?: string
  address: string
  subcity?: string
  wereda?: string
  bloodType?: BloodType | null
  dateOfBirth?: string
  weight: number
  height: number
  lastDonation?: string
  donationIntervalDays?: number
  consentToContact?: boolean
  shareLocation?: boolean
  matchingOptOut?: boolean
}

export interface AvailabilityEntryInput {
  day: Weekday
  startTime: string
  endTime: string
}

export interface UpdateAvailabilityInput {
  currentAvailability: AvailabilityStatus
  availabilities: AvailabilityEntryInput[]
}

export interface CreateDonationRecordInput {
  donatedAt: string
  facilityName?: string
  units?: number
  notes?: string
}

const API_URL = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

export async function getDashboard(): Promise<DonorDashboardData> {
  return apiRequest<DonorDashboardData>('/donor/dashboard')
}

export async function getProfile(): Promise<DonorProfile> {
  const response = await apiRequest<{
    profile: DonorProfile
  }>('/donor/profile')

  return response.profile
}

export async function updateProfile(
  input: UpdateProfileInput
): Promise<DonorProfile> {
  const response = await apiRequest<{
    profile: DonorProfile
  }>('/donor/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.profile
}

export async function updateAvailability(
  input: UpdateAvailabilityInput
): Promise<DonorProfile> {
  const response = await apiRequest<{
    profile: DonorProfile
  }>('/donor/availability', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.profile
}

export async function getEligibility(): Promise<EligibilityResult> {
  const response = await apiRequest<{
    eligibility: EligibilityResult
  }>('/donor/eligibility')

  return response.eligibility
}

export async function getReports(): Promise<MedicalReport[]> {
  const response = await apiRequest<{
    reports: MedicalReport[]
  }>('/donor/reports')

  return response.reports
}

export async function uploadReport(
  reportType: ReportType,
  file: File
): Promise<MedicalReport> {
  const formData = new FormData()
  formData.append('reportType', reportType)
  formData.append('medicalReport', file)

  const response = await apiRequest<{
    report: MedicalReport
  }>('/donor/reports', {
    method: 'POST',
    body: formData,
  })

  return response.report
}

export async function fetchReportFile(
  reportId: number
): Promise<Blob> {
  const token = localStorage.getItem('token')

  const response = await fetch(
    `${API_URL}/donor/reports/${reportId}/file`,
    {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
    }
  )

  if (!response.ok) {
    throw new Error('Unable to open this report')
  }

  return response.blob()
}

export async function getHistory(): Promise<DonationRecord[]> {
  const response = await apiRequest<{
    history: DonationRecord[]
  }>('/donor/history')

  return response.history
}

export async function addDonationRecord(
  input: CreateDonationRecordInput
): Promise<DonationRecord> {
  const response = await apiRequest<{
    record: DonationRecord
  }>('/donor/history', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.record
}

export const BLOOD_TYPE_LABELS: Record<BloodType, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
}

export function verificationLabel(
  status: VerificationStatusValue
): string {
  switch (status) {
    case 'VERIFIED':
      return 'Approved'
    case 'REJECTED':
      return 'Rejected'
    case 'ADDITIONAL_INFO_REQUIRED':
      return 'More information required'
    default:
      return 'Pending review'
  }
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toISOString().slice(0, 10)
}
