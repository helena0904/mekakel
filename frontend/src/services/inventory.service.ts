import apiRequest from './api'
import type { BloodType } from './donor.service'

export type { BloodType }

export type ScreeningStatusValue =
  | 'NOT_TESTED'
  | 'PENDING'
  | 'PASSED'
  | 'FAILED'

export type ConfirmationStatusValue =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'

export type BloodUnitStatusValue =
  | 'PENDING'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'TRANSFERRED'
  | 'USED'
  | 'EXPIRED'
  | 'DISCARDED'

export type ExpiryAlertStatus = 'EXPIRED' | 'EXPIRING_SOON'

export type BloodComponent =
  | 'WHOLE_BLOOD'
  | 'RED_CELLS'
  | 'PLASMA'
  | 'PLATELETS'
  | 'CRYOPRECIPITATE'

export interface BloodUnit {
  id: number
  hospitalProfileId: number
  bagId: string
  bloodType: BloodType
  component: BloodComponent
  collectionDate: string
  expiryDate: string
  screeningStatus: ScreeningStatusValue
  confirmationStatus: ConfirmationStatusValue
  status: BloodUnitStatusValue
  storageLocation: string | null
  storageNotes: string | null
  screenedBy: number | null
  screenedAt: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
  isExpired: boolean
  isAvailable: boolean
  daysUntilExpiry: number
}

export type ExpiryAlert = Omit<BloodUnit, 'status'> & {
  status: ExpiryAlertStatus
}

export interface BloodTypeSummary {
  bloodType: BloodType
  totalUnits: number
  availableUnits: number
  expiredUnits: number
  pendingScreening: number
  pendingConfirmation: number
}

export interface InventorySummary {
  types: BloodTypeSummary[]
  totals: {
    totalUnits: number
    availableUnits: number
    expiredUnits: number
    pendingScreening: number
    pendingConfirmation: number
  }
  generatedAt: string
}

export interface BloodUnitInput {
  bagId: string
  bloodType: BloodType
  component?: BloodComponent
  collectionDate: string
  expiryDate: string
  screeningStatus?: ScreeningStatusValue
  confirmationStatus?: ConfirmationStatusValue
  status?: BloodUnitStatusValue
  storageLocation?: string
  storageNotes?: string
}

export interface BloodUnitFilters {
  search?: string
  bloodType?: BloodType
  component?: BloodComponent
  status?: BloodUnitStatusValue
  screeningStatus?: ScreeningStatusValue
  confirmationStatus?: ConfirmationStatusValue
  availability?: 'available' | 'all'
  expiringWithinDays?: number
}

function buildQuery(filters: BloodUnitFilters): string {
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

export async function getUnits(
  filters: BloodUnitFilters = {}
): Promise<BloodUnit[]> {
  const response = await apiRequest<{
    units: BloodUnit[]
  }>(`/inventory${buildQuery(filters)}`)

  return response.units
}

export async function getUnit(unitId: number): Promise<BloodUnit> {
  const response = await apiRequest<{
    unit: BloodUnit
  }>(`/inventory/${unitId}`)

  return response.unit
}

export async function createUnit(
  input: BloodUnitInput
): Promise<BloodUnit> {
  const response = await apiRequest<{
    unit: BloodUnit
  }>('/inventory', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.unit
}

export async function updateUnit(
  unitId: number,
  input: Partial<BloodUnitInput>
): Promise<BloodUnit> {
  const response = await apiRequest<{
    unit: BloodUnit
  }>(`/inventory/${unitId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.unit
}

export async function deleteUnit(unitId: number): Promise<void> {
  await apiRequest(`/inventory/${unitId}`, {
    method: 'DELETE',
  })
}

export async function getSummary(): Promise<InventorySummary> {
  const response = await apiRequest<{
    summary: InventorySummary
  }>('/inventory/summary')

  return response.summary
}

export async function getExpiryAlerts(
  withinDays = 7
): Promise<ExpiryAlert[]> {
  const response = await apiRequest<{
    alerts: ExpiryAlert[]
  }>(`/inventory/alerts?withinDays=${withinDays}`)

  return response.alerts
}

export const SCREENING_STATUS_LABELS: Record<
  ScreeningStatusValue,
  string
> = {
  NOT_TESTED: 'Not tested',
  PENDING: 'Not screened',
  PASSED: 'Screened',
  FAILED: 'Screening failed',
}

export const CONFIRMATION_STATUS_LABELS: Record<
  ConfirmationStatusValue,
  string
> = {
  PENDING: 'Unconfirmed',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
}

export const BLOOD_UNIT_STATUS_LABELS: Record<
  BloodUnitStatusValue,
  string
> = {
  PENDING: 'Pending',
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  TRANSFERRED: 'In transfer',
  USED: 'Used',
  EXPIRED: 'Expired',
  DISCARDED: 'Discarded',
}

export const BLOOD_COMPONENT_LABELS: Record<
  BloodComponent,
  string
> = {
  WHOLE_BLOOD: 'Whole blood',
  RED_CELLS: 'Red cells',
  PLASMA: 'Plasma',
  PLATELETS: 'Platelets',
  CRYOPRECIPITATE: 'Cryoprecipitate',
}
