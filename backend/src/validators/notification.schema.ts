import { z } from 'zod'

export const NOTIFICATION_CATEGORIES = [
  'DONOR',
  'HOSPITAL',
  'RESERVATION',
  'TRANSFER',
] as const

export const NOTIFICATION_STATUSES = [
  'PENDING',
  'SENT',
  'FAILED',
  'SUPPRESSED',
] as const

export const NOTIFICATION_TYPES = [
  'DONOR_REGISTERED',
  'DONOR_VERIFICATION_APPROVED',
  'DONOR_VERIFICATION_REJECTED',
  'DONOR_ADDITIONAL_INFO_REQUIRED',
  'HOSPITAL_APPROVED',
  'HOSPITAL_REJECTED',
  'HOSPITAL_SUSPENDED',
  'HOSPITAL_ACTIVATED',
  'RESERVATION_CONFIRMED',
  'RESERVATION_CANCELLED',
  'RESERVATION_RELEASED',
  'RESERVATION_EXPIRED',
  'RESERVATION_CONSUMED',
  'TRANSFER_REQUESTED',
  'TRANSFER_APPROVED',
  'TRANSFER_REJECTED',
  'TRANSFER_DISPATCHED',
  'TRANSFER_RECEIVED',
  'TRANSFER_COMPLETED',
  'TRANSFER_CANCELLED',
] as const

export type NotificationCategoryValue =
  (typeof NOTIFICATION_CATEGORIES)[number]

export type NotificationStatusValue =
  (typeof NOTIFICATION_STATUSES)[number]

export type NotificationTypeValue =
  (typeof NOTIFICATION_TYPES)[number]

const CATEGORY_BY_TYPE: Record<
  NotificationTypeValue,
  NotificationCategoryValue
> = {
  DONOR_REGISTERED: 'DONOR',
  DONOR_VERIFICATION_APPROVED: 'DONOR',
  DONOR_VERIFICATION_REJECTED: 'DONOR',
  DONOR_ADDITIONAL_INFO_REQUIRED: 'DONOR',
  HOSPITAL_APPROVED: 'HOSPITAL',
  HOSPITAL_REJECTED: 'HOSPITAL',
  HOSPITAL_SUSPENDED: 'HOSPITAL',
  HOSPITAL_ACTIVATED: 'HOSPITAL',
  RESERVATION_CONFIRMED: 'RESERVATION',
  RESERVATION_CANCELLED: 'RESERVATION',
  RESERVATION_RELEASED: 'RESERVATION',
  RESERVATION_EXPIRED: 'RESERVATION',
  RESERVATION_CONSUMED: 'RESERVATION',
  TRANSFER_REQUESTED: 'TRANSFER',
  TRANSFER_APPROVED: 'TRANSFER',
  TRANSFER_REJECTED: 'TRANSFER',
  TRANSFER_DISPATCHED: 'TRANSFER',
  TRANSFER_RECEIVED: 'TRANSFER',
  TRANSFER_COMPLETED: 'TRANSFER',
  TRANSFER_CANCELLED: 'TRANSFER',
}

export function categoryForType(
  type: NotificationTypeValue
): NotificationCategoryValue {
  return CATEGORY_BY_TYPE[type]
}

export const notificationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const listNotificationsQuerySchema = z.object({
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  unreadOnly: z.preprocess(
    (value) => {
      if (value === 'true' || value === true) {
        return true
      }

      if (value === 'false' || value === false) {
        return false
      }

      return undefined
    },
    z.boolean().optional()
  ),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  donorUpdates: z.boolean().optional(),
  hospitalUpdates: z.boolean().optional(),
  reservationUpdates: z.boolean().optional(),
  transferUpdates: z.boolean().optional(),
})

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>

export type UpdatePreferencesInput = z.infer<
  typeof updatePreferencesSchema
>
