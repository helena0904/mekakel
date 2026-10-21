import apiRequest from './api'
import type {
  HospitalProfile,
  HospitalStatusValue,
  ReviewHospitalInput,
} from './hospital.service'

export type UserRoleValue =
  | 'DONOR'
  | 'HOSPITAL_STAFF'
  | 'DOCTOR'
  | 'ADMIN'
  | 'USER'

export type AuditActionValue =
  | 'DONOR_VERIFICATION_DECIDED'
  | 'HOSPITAL_REGISTRATION_DECIDED'
  | 'USER_ROLE_CHANGED'
  | 'USER_STATUS_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'INVENTORY_UNIT_CREATED'
  | 'INVENTORY_UNIT_UPDATED'
  | 'INVENTORY_UNIT_DELETED'
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_RELEASED'
  | 'RESERVATION_CONSUMED'
  | 'RESERVATION_EXPIRED'
  | 'DONOR_RESPONSE_RECORDED'
  | 'MEDICAL_REPORT_ACCESSED'
  | 'DONOR_BLOOD_REQUESTED'
  | 'CONSENT_CHANGED'
  | 'EMERGENCY_OVERRIDE_USED'
  | 'TRANSFER_REQUESTED'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_REJECTED'
  | 'TRANSFER_DISPATCHED'
  | 'TRANSFER_RECEIVED'
  | 'TRANSFER_COMPLETED'
  | 'TRANSFER_CANCELLED'

export interface AdminUser {
  id: number
  name: string
  email: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
  role: UserRoleValue
  isActive: boolean
  createdAt: string
}

export interface AuditLog {
  id: number
  actorUserId: number | null
  actorName: string | null
  actorRole: UserRoleValue | null
  action: AuditActionValue
  entityType: string
  entityId: number | null
  summary: string
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export interface EligibilitySettings {
  minAge: number
  maxAge: number
  minWeightKg: number
}

export interface CompatibilitySettings {
  enforceRh: boolean
  plasmaReversed: boolean
}

export interface GovernanceSettings {
  eligibility: EligibilitySettings
  compatibility: CompatibilitySettings
}

export interface UserFilters {
  role?: UserRoleValue
  accountType?: 'INDIVIDUAL' | 'HOSPITAL'
  search?: string
  isActive?: boolean
}

export interface AuditLogFilters {
  action?: AuditActionValue
  entityType?: string
  actorUserId?: number
  limit?: number
}

export interface UpdateUserInput {
  role?: UserRoleValue
  isActive?: boolean
}

export interface UpdateGovernanceSettingsInput {
  eligibility?: Partial<EligibilitySettings>
  compatibility?: Partial<CompatibilitySettings>
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

export async function listUsers(
  filters: UserFilters = {}
): Promise<AdminUser[]> {
  const response = await apiRequest<{ users: AdminUser[] }>(
    `/admin/users${buildQuery(filters)}`
  )

  return response.users
}

export async function updateUser(
  userId: number,
  input: UpdateUserInput
): Promise<AdminUser> {
  const response = await apiRequest<{ user: AdminUser }>(
    `/admin/users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  )

  return response.user
}

export async function listHospitalApprovals(): Promise<
  HospitalProfile[]
> {
  const response = await apiRequest<{
    hospitals: HospitalProfile[]
  }>('/admin/hospitals')

  return response.hospitals
}

export async function reviewHospitalApproval(
  hospitalId: number,
  input: ReviewHospitalInput
): Promise<HospitalProfile> {
  const response = await apiRequest<{
    hospital: HospitalProfile
  }>(`/admin/hospitals/${hospitalId}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.hospital
}

export async function listAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLog[]> {
  const response = await apiRequest<{ logs: AuditLog[] }>(
    `/admin/audit-logs${buildQuery(filters)}`
  )

  return response.logs
}

export async function getGovernanceSettings(): Promise<GovernanceSettings> {
  const response = await apiRequest<{
    settings: GovernanceSettings
  }>('/admin/settings')

  return response.settings
}

export async function updateGovernanceSettings(
  input: UpdateGovernanceSettingsInput
): Promise<GovernanceSettings> {
  const response = await apiRequest<{
    settings: GovernanceSettings
  }>('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.settings
}

export const USER_ROLE_LABELS: Record<UserRoleValue, string> = {
  DONOR: 'Donor',
  HOSPITAL_STAFF: 'Hospital staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Administrator',
  USER: 'User',
}

export const AUDIT_ACTION_LABELS: Record<
  AuditActionValue,
  string
> = {
  DONOR_VERIFICATION_DECIDED: 'Donor verification decision',
  HOSPITAL_REGISTRATION_DECIDED: 'Hospital registration decision',
  USER_ROLE_CHANGED: 'User role changed',
  USER_STATUS_CHANGED: 'User status changed',
  SETTINGS_UPDATED: 'Settings updated',
  INVENTORY_UNIT_CREATED: 'Inventory unit created',
  INVENTORY_UNIT_UPDATED: 'Inventory unit updated',
  INVENTORY_UNIT_DELETED: 'Inventory unit deleted',
  RESERVATION_CREATED: 'Reservation created',
  RESERVATION_CONFIRMED: 'Reservation confirmed',
  RESERVATION_CANCELLED: 'Reservation cancelled',
  RESERVATION_RELEASED: 'Reservation released',
  RESERVATION_CONSUMED: 'Reservation consumed',
  RESERVATION_EXPIRED: 'Reservation expired',
  DONOR_RESPONSE_RECORDED: 'Donor response recorded',
  MEDICAL_REPORT_ACCESSED: 'Medical report accessed',
  DONOR_BLOOD_REQUESTED: 'Donor blood requested',
  CONSENT_CHANGED: 'Consent changed',
  EMERGENCY_OVERRIDE_USED: 'Emergency override used',
  TRANSFER_REQUESTED: 'Transfer requested',
  TRANSFER_APPROVED: 'Transfer approved',
  TRANSFER_REJECTED: 'Transfer rejected',
  TRANSFER_DISPATCHED: 'Transfer dispatched',
  TRANSFER_RECEIVED: 'Transfer received',
  TRANSFER_COMPLETED: 'Transfer completed',
  TRANSFER_CANCELLED: 'Transfer cancelled',
}

export const USER_ROLES = Object.keys(
  USER_ROLE_LABELS
) as UserRoleValue[]

export const AUDIT_ACTIONS = Object.keys(
  AUDIT_ACTION_LABELS
) as AuditActionValue[]

export type { HospitalStatusValue }
