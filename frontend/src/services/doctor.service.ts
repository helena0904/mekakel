import apiRequest, { API_URL } from './api'
import type {
  DonorProfile,
  EligibilityResult,
  MedicalReport,
  VerificationStatusValue,
} from './donor.service'

export type VerificationQueueStatus =
  | 'PENDING'
  | 'ADDITIONAL_INFO_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ALL'

export type DonorReviewDecision =
  | 'VERIFY'
  | 'REJECT'
  | 'REQUEST_INFO'

export interface VerificationDonorUser {
  id: number
  name: string
  email: string
  isActive: boolean
}

export interface VerificationQueueItem {
  id: number
  userId: number
  bloodType: string | null
  dateOfBirth: string | null
  weight: number
  address: string
  verificationStatus: VerificationStatusValue
  verificationNotes: string | null
  verifiedAt: string | null
  createdAt: string
  user: VerificationDonorUser
  medicalReports: MedicalReport[]
}

export interface VerificationDetail {
  donor: DonorProfile & { user: VerificationDonorUser }
  eligibility: EligibilityResult
  latestReport: MedicalReport | null
}

export interface VerificationQueueFilters {
  status?: VerificationQueueStatus
  limit?: number
}

export interface ReviewVerificationInput {
  decision: DonorReviewDecision
  notes?: string
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  })

  const query = params.toString()

  return query ? `?${query}` : ''
}

export async function listVerificationQueue(
  filters: VerificationQueueFilters = {}
): Promise<VerificationQueueItem[]> {
  const response = await apiRequest<{
    donors: VerificationQueueItem[]
  }>(`/doctor/verifications${buildQuery(filters)}`)

  return response.donors
}

export async function getVerification(
  donorProfileId: number
): Promise<VerificationDetail> {
  return apiRequest<VerificationDetail>(
    `/doctor/verifications/${donorProfileId}`
  )
}

export async function reviewVerification(
  donorProfileId: number,
  input: ReviewVerificationInput
): Promise<VerificationQueueItem> {
  const response = await apiRequest<{
    donor: VerificationQueueItem
  }>(`/doctor/verifications/${donorProfileId}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.donor
}

// Medical reports are private: fetch with the bearer token and hand the
// caller a short-lived object URL rather than a directly linkable file path.
export async function fetchReportObjectUrl(
  reportId: number
): Promise<string> {
  const token = localStorage.getItem('token')

  const response = await fetch(
    `${API_URL}/doctor/reports/${reportId}/file`,
    {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
    }
  )

  if (!response.ok) {
    throw new Error('Unable to open the medical report')
  }

  const blob = await response.blob()

  return URL.createObjectURL(blob)
}

export const VERIFICATION_STATUS_LABELS: Record<
  VerificationStatusValue,
  string
> = {
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ADDITIONAL_INFO_REQUIRED: 'Additional info required',
}

export const VERIFICATION_QUEUE_STATUS_LABELS: Record<
  VerificationQueueStatus,
  string
> = {
  PENDING: 'Pending review',
  ADDITIONAL_INFO_REQUIRED: 'Additional info required',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ALL: 'All donors',
}

export function verificationStatusBadgeClass(
  status: VerificationStatusValue
): string {
  switch (status) {
    case 'VERIFIED':
      return 'status-badge status-badge-approved'
    case 'REJECTED':
      return 'status-badge status-badge-rejected'
    case 'ADDITIONAL_INFO_REQUIRED':
      return 'status-badge status-badge-pending'
    default:
      return 'status-badge status-badge-info'
  }
}
