import apiRequest from './api'
import type { BloodType } from './donor.service'
import type { BloodComponent } from './inventory.service'
import type { HospitalStaffRoleValue } from './hospital.service'

export type { BloodComponent }

export type RequestUrgencyValue =
  | 'ROUTINE'
  | 'URGENT'
  | 'EMERGENCY'

export type BloodRequestStatusValue =
  | 'OPEN'
  | 'FULFILLED'
  | 'CANCELLED'

export interface BloodRequest {
  id: number
  hospitalProfileId: number
  createdByUserId: number
  component: BloodComponent
  bloodType: BloodType
  requiredUnits: number
  urgency: RequestUrgencyValue
  location: string | null
  notes: string | null
  status: BloodRequestStatusValue
  createdAt: string
  updatedAt: string
}

export interface BloodRequestInput {
  component: BloodComponent
  bloodType: BloodType
  requiredUnits: number
  urgency: RequestUrgencyValue
  location?: string
  notes?: string
}

export interface BloodRequestFilters {
  status?: BloodRequestStatusValue
  bloodType?: BloodType
  component?: BloodComponent
  urgency?: RequestUrgencyValue
}

function buildQuery(filters: BloodRequestFilters): string {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return
    }

    params.set(key, String(value))
  })

  const query = params.toString()

  return query ? `?${query}` : ''
}

export async function getRequests(
  filters: BloodRequestFilters = {}
): Promise<BloodRequest[]> {
  const response = await apiRequest<{
    requests: BloodRequest[]
  }>(`/requests${buildQuery(filters)}`)

  return response.requests
}

export async function getRequest(
  requestId: number
): Promise<BloodRequest> {
  const response = await apiRequest<{
    request: BloodRequest
  }>(`/requests/${requestId}`)

  return response.request
}

export async function createRequest(
  input: BloodRequestInput
): Promise<BloodRequest> {
  const response = await apiRequest<{
    request: BloodRequest
  }>('/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.request
}

export async function updateRequestStatus(
  requestId: number,
  status: BloodRequestStatusValue
): Promise<BloodRequest> {
  const response = await apiRequest<{
    request: BloodRequest
  }>(`/requests/${requestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

  return response.request
}

export async function deleteRequest(
  requestId: number
): Promise<void> {
  await apiRequest(`/requests/${requestId}`, {
    method: 'DELETE',
  })
}

export const REQUEST_URGENCY_LABELS: Record<
  RequestUrgencyValue,
  string
> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
}

export const BLOOD_REQUEST_STATUS_LABELS: Record<
  BloodRequestStatusValue,
  string
> = {
  OPEN: 'Open',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
}

export function requestStatusBadgeClass(
  status: BloodRequestStatusValue
): string {
  switch (status) {
    case 'FULFILLED':
      return 'status-badge status-badge-approved'
    case 'CANCELLED':
      return 'status-badge status-badge-rejected'
    default:
      return 'status-badge status-badge-info'
  }
}

export function canManageRequests(
  role: HospitalStaffRoleValue | null
): boolean {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'TECHNICIAN'
  )
}
