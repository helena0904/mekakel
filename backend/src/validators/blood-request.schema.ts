import { z } from 'zod'

import { BLOOD_TYPES } from './donor.schema'
import { BLOOD_COMPONENTS } from './inventory.schema'

export { BLOOD_COMPONENTS }

export const REQUEST_URGENCIES = [
  'ROUTINE',
  'URGENT',
  'EMERGENCY',
] as const

export const BLOOD_REQUEST_STATUSES = [
  'OPEN',
  'FULFILLED',
  'CANCELLED',
] as const

export type BloodRequestStatusValue =
  (typeof BLOOD_REQUEST_STATUSES)[number]

export const createBloodRequestSchema = z.object({
  component: z.enum(BLOOD_COMPONENTS),

  bloodType: z.enum(BLOOD_TYPES),

  requiredUnits: z.coerce
    .number()
    .int()
    .min(1, 'At least one unit is required')
    .max(100, 'Required units cannot exceed 100'),

  urgency: z.enum(REQUEST_URGENCIES).optional(),

  location: z.string().trim().max(200).optional(),

  notes: z.string().trim().max(1000).optional(),
})

export const listBloodRequestsQuerySchema = z.object({
  status: z.enum(BLOOD_REQUEST_STATUSES).optional(),

  bloodType: z.enum(BLOOD_TYPES).optional(),

  component: z.enum(BLOOD_COMPONENTS).optional(),

  urgency: z.enum(REQUEST_URGENCIES).optional(),
})

export const updateBloodRequestStatusSchema = z.object({
  status: z.enum(BLOOD_REQUEST_STATUSES),
})

export type CreateBloodRequestInput = z.infer<
  typeof createBloodRequestSchema
>

export type ListBloodRequestsQuery = z.infer<
  typeof listBloodRequestsQuerySchema
>

export type UpdateBloodRequestStatusInput = z.infer<
  typeof updateBloodRequestStatusSchema
>
