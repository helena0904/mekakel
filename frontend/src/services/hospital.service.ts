import apiRequest from './api'

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
  phone: string
  additionalPhone?: string
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
