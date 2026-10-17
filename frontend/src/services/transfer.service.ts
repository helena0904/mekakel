import apiRequest from './api'
import type { BloodUnit } from './inventory.service'
import type { HospitalStaffRoleValue } from './hospital.service'

export type TransferStatusValue =
  | 'REQUESTED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export interface TransferHospital {
  id: number
  hospitalName: string
  address: string
  phone: string
}

export interface TransferEvent {
  id: number
  transferId: number
  fromStatus: TransferStatusValue | null
  toStatus: TransferStatusValue
  note: string | null
  actorUserId: number | null
  createdAt: string
}

export interface Transfer {
  id: number
  bloodUnitId: number
  fromHospitalProfileId: number
  toHospitalProfileId: number
  reservationId: number | null
  status: TransferStatusValue
  reason: string | null
  notes: string | null
  rejectionReason: string | null
  requestedByUserId: number
  approvedByUserId: number | null
  dispatchedByUserId: number | null
  receivedByUserId: number | null
  completedByUserId: number | null
  approvedAt: string | null
  dispatchedAt: string | null
  receivedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  bloodUnit: BloodUnit
  fromHospital: TransferHospital
  toHospital: TransferHospital
  events: TransferEvent[]
}

export interface TransferInput {
  bloodUnitId: number
  toHospitalProfileId: number
  reservationId?: number
  reason?: string
  notes?: string
}

export interface TransferFilters {
  status?: TransferStatusValue
  direction?: 'incoming' | 'outgoing' | 'all'
  bloodUnitId?: number
}

export interface TransferDestination {
  id: number
  hospitalName: string
  address: string
  phone: string
}

function buildQuery(filters: TransferFilters): string {
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

export async function getTransfers(
  filters: TransferFilters = {}
): Promise<Transfer[]> {
  const response = await apiRequest<{
    transfers: Transfer[]
  }>(`/transfers${buildQuery(filters)}`)

  return response.transfers
}

export async function getTransfer(
  transferId: number
): Promise<Transfer> {
  const response = await apiRequest<{
    transfer: Transfer
  }>(`/transfers/${transferId}`)

  return response.transfer
}

export async function getTransferDestinations(): Promise<
  TransferDestination[]
> {
  const response = await apiRequest<{
    hospitals: TransferDestination[]
  }>('/transfers/destinations')

  return response.hospitals
}

export async function createTransfer(
  input: TransferInput
): Promise<Transfer> {
  const response = await apiRequest<{
    transfer: Transfer
  }>('/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.transfer
}

async function transferAction(
  transferId: number,
  action:
    | 'approve'
    | 'reject'
    | 'dispatch'
    | 'receive'
    | 'complete'
    | 'cancel',
  body: Record<string, unknown> = {}
): Promise<Transfer> {
  const response = await apiRequest<{
    transfer: Transfer
  }>(`/transfers/${transferId}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return response.transfer
}

export function approveTransfer(
  transferId: number,
  note?: string
): Promise<Transfer> {
  return transferAction(transferId, 'approve', { note })
}

export function rejectTransfer(
  transferId: number,
  reason?: string
): Promise<Transfer> {
  return transferAction(transferId, 'reject', { reason })
}

export function dispatchTransfer(
  transferId: number,
  note?: string
): Promise<Transfer> {
  return transferAction(transferId, 'dispatch', { note })
}

export function receiveTransfer(
  transferId: number,
  note?: string
): Promise<Transfer> {
  return transferAction(transferId, 'receive', { note })
}

export function completeTransfer(
  transferId: number,
  note?: string
): Promise<Transfer> {
  return transferAction(transferId, 'complete', { note })
}

export function cancelTransfer(
  transferId: number,
  note?: string
): Promise<Transfer> {
  return transferAction(transferId, 'cancel', { note })
}

export const TRANSFER_STATUS_LABELS: Record<
  TransferStatusValue,
  string
> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  DISPATCHED: 'Dispatched',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export function transferStatusBadgeClass(
  status: TransferStatusValue
): string {
  switch (status) {
    case 'COMPLETED':
      return 'status-badge status-badge-approved'
    case 'REJECTED':
    case 'CANCELLED':
      return 'status-badge status-badge-rejected'
    case 'REQUESTED':
      return 'status-badge status-badge-info'
    default:
      return 'status-badge status-badge-pending'
  }
}

export function canManageTransfers(
  role: HospitalStaffRoleValue | null
): boolean {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    role === 'TECHNICIAN'
  )
}

export function transferDirection(
  transfer: Transfer,
  hospitalProfileId: number | null
): 'incoming' | 'outgoing' {
  return transfer.toHospitalProfileId === hospitalProfileId
    ? 'incoming'
    : 'outgoing'
}
