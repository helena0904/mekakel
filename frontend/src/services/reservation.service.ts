import apiRequest from './api'
import type { BloodType } from './donor.service'
import type {
  BloodComponent,
  BloodUnit,
} from './inventory.service'
import type { BloodRequestStatusValue } from './blood-request.service'
import type { HospitalStaffRoleValue } from './hospital.service'

export type ReservationStatusValue =
  | 'ACTIVE'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'RELEASED'
  | 'CONSUMED'

export type DonorResponseStatusValue =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'NO_SHOW'

export interface ReservationBloodRequest {
  id: number
  bloodType: BloodType
  component: BloodComponent
  requiredUnits: number
  status: BloodRequestStatusValue
}

export type ReservationKindValue = 'BLOOD_UNIT' | 'DONOR'

export interface ReservationHospital {
  id: number
  hospitalName: string
  address: string
  subcity: string | null
  wereda: string | null
  phone: string
}

export interface ReservationDonor {
  id: number
  phone: string
  additionalPhone: string | null
  address: string | null
  bloodType: BloodType | null
  consentToContact: boolean
  shareLocation: boolean
  verificationStatus: string
  user: { name: string; isActive: boolean }
}

export interface Reservation {
  id: number
  bloodUnitId: number | null
  bloodRequestId: number | null
  hospitalProfileId: number
  donorProfileId: number | null
  kind: ReservationKindValue
  status: ReservationStatusValue
  donorResponse: DonorResponseStatusValue
  donorRespondedAt: string | null
  expiresAt: string
  notes: string | null
  reason: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  releasedAt: string | null
  consumedAt: string | null
  createdByUserId: number
  createdAt: string
  updatedAt: string
  isExpired: boolean
  bloodUnit: BloodUnit | null
  bloodRequest: ReservationBloodRequest | null
  donorProfile: ReservationDonor | null
  hospitalProfile: ReservationHospital
}

export interface ReservationInput {
  bloodUnitId?: number
  bloodRequestId?: number
  donorProfileId?: number
  expiresInMinutes?: number
  notes?: string
}

export interface ReservationFilters {
  status?: ReservationStatusValue
  bloodUnitId?: number
  bloodRequestId?: number
}

function buildQuery(filters: ReservationFilters): string {
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

export async function getReservations(
  filters: ReservationFilters = {}
): Promise<Reservation[]> {
  const response = await apiRequest<{
    reservations: Reservation[]
  }>(`/reservations${buildQuery(filters)}`)

  return response.reservations
}

export async function getDonorReservations(
  filters: ReservationFilters = {}
): Promise<Reservation[]> {
  const response = await apiRequest<{
    reservations: Reservation[]
  }>(`/reservations/donor${buildQuery(filters)}`)

  return response.reservations
}

export async function getReservation(
  reservationId: number
): Promise<Reservation> {
  const response = await apiRequest<{
    reservation: Reservation
  }>(`/reservations/${reservationId}`)

  return response.reservation
}

export async function createReservation(
  input: ReservationInput
): Promise<Reservation> {
  const response = await apiRequest<{
    reservation: Reservation
  }>('/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.reservation
}

async function reservationAction(
  reservationId: number,
  action: 'confirm' | 'cancel' | 'release' | 'consume',
  body: Record<string, unknown> = {}
): Promise<Reservation> {
  const response = await apiRequest<{
    reservation: Reservation
  }>(`/reservations/${reservationId}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return response.reservation
}

export function confirmReservation(
  reservationId: number
): Promise<Reservation> {
  return reservationAction(reservationId, 'confirm')
}

export function cancelReservation(
  reservationId: number,
  reason?: string
): Promise<Reservation> {
  return reservationAction(reservationId, 'cancel', { reason })
}

export function releaseReservation(
  reservationId: number,
  reason?: string
): Promise<Reservation> {
  return reservationAction(reservationId, 'release', { reason })
}

export function consumeReservation(
  reservationId: number
): Promise<Reservation> {
  return reservationAction(reservationId, 'consume')
}

export async function recordDonorResponse(
  reservationId: number,
  donorResponse: 'ACCEPTED' | 'DECLINED',
  note?: string
): Promise<Reservation> {
  const response = await apiRequest<{
    reservation: Reservation
  }>(`/reservations/${reservationId}/donor-response`, {
    method: 'PATCH',
    body: JSON.stringify({ donorResponse, note }),
  })

  return response.reservation
}

export const RESERVATION_STATUS_LABELS: Record<
  ReservationStatusValue,
  string
> = {
  ACTIVE: 'Active',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  RELEASED: 'Released',
  CONSUMED: 'Used',
}

export const DONOR_RESPONSE_STATUS_LABELS: Record<
  DonorResponseStatusValue,
  string
> = {
  PENDING: 'Awaiting response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  NO_SHOW: 'No-show',
}

export function reservationStatusBadgeClass(
  status: ReservationStatusValue
): string {
  switch (status) {
    case 'CONFIRMED':
    case 'CONSUMED':
      return 'status-badge status-badge-approved'
    case 'CANCELLED':
    case 'EXPIRED':
      return 'status-badge status-badge-rejected'
    case 'RELEASED':
      return 'status-badge status-badge-pending'
    default:
      return 'status-badge status-badge-info'
  }
}

export function canManageReservations(
  role: HospitalStaffRoleValue | null
): boolean {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'TECHNICIAN'
  )
}

export function isReservationOpen(
  reservation: Reservation
): boolean {
  return (
    reservation.status === 'ACTIVE' ||
    reservation.status === 'CONFIRMED'
  )
}
