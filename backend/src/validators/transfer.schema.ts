import { z } from 'zod'

export const TRANSFER_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'DISPATCHED',
  'RECEIVED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const

export type TransferStatusValue =
  (typeof TRANSFER_STATUSES)[number]

export const createTransferSchema = z
  .object({
    bloodUnitId: z.coerce
      .number()
      .int()
      .positive('A valid blood unit is required'),

    toHospitalProfileId: z.coerce
      .number()
      .int()
      .positive('A destination hospital is required'),

    reservationId: z.coerce
      .number()
      .int()
      .positive()
      .optional(),

    reason: z.string().trim().max(500).optional(),

    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) => value.toHospitalProfileId > 0,
    {
      message: 'A destination hospital is required',
      path: ['toHospitalProfileId'],
    }
  )

export const listTransfersQuerySchema = z.object({
  status: z.enum(TRANSFER_STATUSES).optional(),

  direction: z
    .enum(['incoming', 'outgoing', 'all'])
    .optional(),

  bloodUnitId: z.coerce.number().int().positive().optional(),
})

export const transferActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
})

export const rejectTransferSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export type CreateTransferInput = z.infer<
  typeof createTransferSchema
>

export type ListTransfersQuery = z.infer<
  typeof listTransfersQuerySchema
>

export type TransferActionInput = z.infer<
  typeof transferActionSchema
>

export type RejectTransferInput = z.infer<
  typeof rejectTransferSchema
>
