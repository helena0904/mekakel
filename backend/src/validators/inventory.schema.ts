import { z } from 'zod'

import {
  BLOOD_TYPES,
  isValidIsoDate,
} from './donor.schema'

export const SCREENING_STATUSES = [
  'NOT_TESTED',
  'PENDING',
  'PASSED',
  'FAILED',
] as const

export const CONFIRMATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
] as const

export const BLOOD_UNIT_STATUSES = [
  'PENDING',
  'AVAILABLE',
  'RESERVED',
  'TRANSFERRED',
  'USED',
  'EXPIRED',
  'DISCARDED',
] as const

export const BLOOD_COMPONENTS = [
  'WHOLE_BLOOD',
  'RED_CELLS',
  'PLASMA',
  'PLATELETS',
  'CRYOPRECIPITATE',
] as const

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .refine(isValidIsoDate, `Invalid ${label}`)

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional()

export const createBloodUnitSchema = z
  .object({
    bagId: z
      .string()
      .trim()
      .min(1, 'Bag ID is required')
      .max(64, 'Bag ID is too long'),

    bloodType: z.enum(BLOOD_TYPES),

    component: z.enum(BLOOD_COMPONENTS).optional(),

    collectionDate: isoDate('collection date'),

    expiryDate: isoDate('expiry date'),

    screeningStatus: z.enum(SCREENING_STATUSES).optional(),

    confirmationStatus: z
      .enum(CONFIRMATION_STATUSES)
      .optional(),

    status: z.enum(BLOOD_UNIT_STATUSES).optional(),

    storageLocation: optionalTrimmed(200),

    storageNotes: optionalTrimmed(500),

    quantity: z.coerce
      .number()
      .int()
      .min(1, 'Quantity must be at least 1')
      .max(500, 'Quantity cannot exceed 500')
      .optional(),
  })
  .refine(
    (value) =>
      new Date(value.expiryDate) >
      new Date(value.collectionDate),
    {
      message: 'Expiry date must be after collection date',
      path: ['expiryDate'],
    }
  )

export const updateBloodUnitSchema = z.object({
  bagId: z.string().trim().min(1).max(64).optional(),

  bloodType: z.enum(BLOOD_TYPES).optional(),

  component: z.enum(BLOOD_COMPONENTS).optional(),

  collectionDate: isoDate('collection date').optional(),

  expiryDate: isoDate('expiry date').optional(),

  screeningStatus: z.enum(SCREENING_STATUSES).optional(),

  confirmationStatus: z
    .enum(CONFIRMATION_STATUSES)
    .optional(),

  status: z.enum(BLOOD_UNIT_STATUSES).optional(),

  storageLocation: optionalTrimmed(200),

  storageNotes: optionalTrimmed(500),
})

export const listBloodUnitsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),

  bloodType: z.enum(BLOOD_TYPES).optional(),

  component: z.enum(BLOOD_COMPONENTS).optional(),

  status: z.enum(BLOOD_UNIT_STATUSES).optional(),

  screeningStatus: z.enum(SCREENING_STATUSES).optional(),

  confirmationStatus: z
    .enum(CONFIRMATION_STATUSES)
    .optional(),

  availability: z.enum(['available', 'all']).optional(),

  expiringWithinDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .optional(),
})

export type CreateBloodUnitInput = z.infer<
  typeof createBloodUnitSchema
>

export type UpdateBloodUnitInput = z.infer<
  typeof updateBloodUnitSchema
>

export type ListBloodUnitsQuery = z.infer<
  typeof listBloodUnitsQuerySchema
>
