import { z } from 'zod'

export const RESERVATION_STATUSES = [
  'ACTIVE',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'RELEASED',
  'CONSUMED',
] as const

export const DONOR_RESPONSE_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'NO_SHOW',
] as const

export const DEFAULT_RESERVATION_TTL_MINUTES = 1440
export const MIN_RESERVATION_TTL_MINUTES = 5
export const MAX_RESERVATION_TTL_MINUTES = 10080

export type ReservationStatusValue =
  (typeof RESERVATION_STATUSES)[number]

export type DonorResponseStatusValue =
  (typeof DONOR_RESPONSE_STATUSES)[number]

export const createReservationSchema = z.object({
  bloodUnitId: z.coerce
    .number()
    .int()
    .positive('A valid blood unit is required'),

  bloodRequestId: z.coerce
    .number()
    .int()
    .positive()
    .optional(),

  donorProfileId: z.coerce
    .number()
    .int()
    .positive()
    .optional(),

  expiresInMinutes: z.coerce
    .number()
    .int()
    .min(
      MIN_RESERVATION_TTL_MINUTES,
      `Reservation must last at least ${MIN_RESERVATION_TTL_MINUTES} minutes`
    )
    .max(
      MAX_RESERVATION_TTL_MINUTES,
      `Reservation cannot last more than ${MAX_RESERVATION_TTL_MINUTES} minutes`
    )
    .optional(),

  notes: z.string().trim().max(500).optional(),
})

export const listReservationsQuerySchema = z.object({
  status: z.enum(RESERVATION_STATUSES).optional(),

  bloodUnitId: z.coerce.number().int().positive().optional(),

  bloodRequestId: z.coerce.number().int().positive().optional(),
})

export const donorResponseSchema = z.object({
  donorResponse: z.enum([
    'ACCEPTED',
    'DECLINED',
    'NO_SHOW',
  ]),

  note: z.string().trim().max(500).optional(),
})

export const reservationActionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export type CreateReservationInput = z.infer<
  typeof createReservationSchema
>

export type ListReservationsQuery = z.infer<
  typeof listReservationsQuerySchema
>

export type DonorResponseInput = z.infer<
  typeof donorResponseSchema
>

export type ReservationActionInput = z.infer<
  typeof reservationActionSchema
>
