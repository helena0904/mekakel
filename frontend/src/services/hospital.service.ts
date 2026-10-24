import apiRequest, { API_URL } from './api'

export type HospitalStatusValue =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'

export type HospitalStaffRoleValue =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'TECHNICIAN'
  | 'VIEWER'

export interface HospitalStaffUser {
  id: number
  name: string
  email: string
  isActive: boolean
}

export interface HospitalProfile {
  id: number
  userId: number
  hospitalName: string
  address: string
  subcity: string | null
  wereda: string | null
  phone: string
  additionalPhone: string | null
  isVerified: boolean
  status: HospitalStatusValue
  reviewNotes: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  user?: HospitalStaffUser
  _count?: {
    staff: number
    bloodUnits: number
  }
}

export interface HospitalStaffMember {
  id: number
  hospitalProfileId: number
  userId: number
  staffRole: HospitalStaffRoleValue
  isActive: boolean
  createdAt: string
  updatedAt: string
  user: HospitalStaffUser
}

export interface UpdateHospitalProfileInput {
  hospitalName: string
  address: string
  subcity?: string
  wereda?: string
  phone: string
  additionalPhone?: string
}

export interface NearbyHospitalUnitSummary {
  bloodType: string
  component: string
  availableUnits: number
}

export interface NearbyHospitalUnitDetail {
  id: number
  bagId: string
  bloodType: string
  component: string
  collectionDate: string
  expiryDate: string
  storageLocation: string | null
}

export interface NearbyHospital {
  id: number
  hospitalName: string
  address: string
  subcity: string | null
  wereda: string | null
  phone: string
  additionalPhone: string | null
  availableUnits: number
  unitSummary: NearbyHospitalUnitSummary[]
  unitDetails: NearbyHospitalUnitDetail[]
}

export interface NearbyDonor {
  donorProfileId: number
  displayName: string
  bloodType: string | null
  activeStatus: string
  subcity: string | null
  wereda: string | null
  address: string | null
  contactAllowed: boolean
  contactPhone: string | null
  lastDonation: string | null
  nextEligibleDate: string | null
  compatibility: {
    compatible: boolean
    explanation: string
    [key: string]: unknown
  } | null
}

export interface HospitalDonorReport {
  id: number
  reportType: 'IMAGE' | 'PDF'
  verificationStatus: string
  createdAt: string
  verifiedAt: string | null
  rejectionReason: string | null
}

export interface HospitalDonorDonation {
  id: number
  donatedAt: string
  facilityName: string | null
  units: number | null
  notes: string | null
}

export interface HospitalDonorDetail {
  donorProfileId: number
  displayName: string
  email: string | null
  bloodType: string | null
  dateOfBirth: string | null
  age: number
  weight: number
  height: number
  subcity: string | null
  wereda: string | null
  address: string | null
  phone: string | null
  additionalPhone: string | null
  contactAllowed: boolean
  currentAvailability: string
  activeStatus: string
  verificationStatus: string
  verifiedAt: string | null
  lastDonation: string | null
  nextEligibleDate: string | null
  donationIntervalDays: number
  medicalReports: HospitalDonorReport[]
  reportsRestricted: boolean
  donationHistory: HospitalDonorDonation[]
  availabilities: Array<{ day: string; time: string }>
}

export interface HospitalSearchFilters {
  bloodType?: string
  component?: string
  subcity?: string
  wereda?: string
  q?: string
}

export interface HospitalSearchResult {
  location: {
    subcity: string | null
    wereda: string | null
  }
  bloodType: string | null
  component: string
  hospitals: NearbyHospital[]
  donors: NearbyDonor[]
  generatedAt: string
}

export async function searchNearby(
  filters: HospitalSearchFilters = {}
): Promise<HospitalSearchResult> {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })

  const query = params.toString()

  return apiRequest(`/hospital/search${query ? `?${query}` : ''}`)
}

export async function getNearbyDonorDetail(
  donorProfileId: number
): Promise<HospitalDonorDetail> {
  const response = await apiRequest<{
    donor: HospitalDonorDetail
  }>(`/hospital/donors/${donorProfileId}`)

  return response.donor
}

export async function requestDonorBlood(
  donorProfileId: number
): Promise<{
  donorProfileId: number
  donorName: string
  notificationId: number | null
}> {
  const response = await apiRequest<{
    request: {
      donorProfileId: number
      donorName: string
      notificationId: number | null
    }
  }>(`/hospital/donors/${donorProfileId}/request`, {
    method: 'POST',
  })

  return response.request
}

export async function fetchDonorReportObjectUrl(
  reportId: number
): Promise<string> {
  const token = localStorage.getItem('token')

  const response = await fetch(
    `${API_URL}/hospital/reports/${reportId}/file`,
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

export interface CreateStaffInput {
  name: string
  email: string
  password: string
  staffRole: Exclude<HospitalStaffRoleValue, 'OWNER'>
}

export interface UpdateStaffInput {
  staffRole?: Exclude<HospitalStaffRoleValue, 'OWNER'>
  isActive?: boolean
}

export interface ReviewHospitalInput {
  decision: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'ACTIVATE'
  notes?: string
}

export async function getHospitalDashboard(): Promise<{
  hospital: HospitalProfile
  role: HospitalStaffRoleValue
}> {
  return apiRequest('/hospital/dashboard')
}

export async function getHospitalProfile(): Promise<{
  profile: HospitalProfile
  role: HospitalStaffRoleValue
}> {
  return apiRequest('/hospital/profile')
}

export async function updateHospitalProfile(
  input: UpdateHospitalProfileInput
): Promise<HospitalProfile> {
  const response = await apiRequest<{
    profile: HospitalProfile
  }>('/hospital/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.profile
}

export async function getStaff(): Promise<
  HospitalStaffMember[]
> {
  const response = await apiRequest<{
    staff: HospitalStaffMember[]
  }>('/hospital/staff')

  return response.staff
}

export async function addStaff(
  input: CreateStaffInput
): Promise<HospitalStaffMember> {
  const response = await apiRequest<{
    staff: HospitalStaffMember
  }>('/hospital/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.staff
}

export async function updateStaffMember(
  staffId: number,
  input: UpdateStaffInput
): Promise<HospitalStaffMember> {
  const response = await apiRequest<{
    staff: HospitalStaffMember
  }>(`/hospital/staff/${staffId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return response.staff
}

export async function removeStaffMember(
  staffId: number
): Promise<void> {
  await apiRequest(`/hospital/staff/${staffId}`, {
    method: 'DELETE',
  })
}

export async function listHospitalRegistrations(): Promise<
  HospitalProfile[]
> {
  const response = await apiRequest<{
    hospitals: HospitalProfile[]
  }>('/hospital/admin/hospitals')

  return response.hospitals
}

export async function reviewHospitalRegistration(
  hospitalId: number,
  input: ReviewHospitalInput
): Promise<HospitalProfile> {
  const response = await apiRequest<{
    hospital: HospitalProfile
  }>(`/hospital/admin/hospitals/${hospitalId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.hospital
}

export const HOSPITAL_STATUS_LABELS: Record<
  HospitalStatusValue,
  string
> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}

export const HOSPITAL_STAFF_ROLE_LABELS: Record<
  HospitalStaffRoleValue,
  string
> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  TECHNICIAN: 'Technician',
  VIEWER: 'Viewer',
}

export function hospitalStatusBadgeClass(
  status: HospitalStatusValue
): string {
  switch (status) {
    case 'APPROVED':
      return 'status-badge status-badge-approved'
    case 'REJECTED':
      return 'status-badge status-badge-rejected'
    case 'SUSPENDED':
      return 'status-badge status-badge-pending'
    default:
      return 'status-badge status-badge-info'
  }
}

export function canManageHospital(
  role: HospitalStaffRoleValue | null
): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canWriteInventory(
  role: HospitalStaffRoleValue | null
): boolean {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'TECHNICIAN'
  )
}
