import { z } from 'zod'

export const BLOOD_TYPES = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
] as const

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false
  }

  const date = new Date(value)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      value === '' || value == null ? undefined : Number(value),
    schema.optional()
  )

export const availabilityEntrySchema = z.object({
  day: z.enum(WEEKDAYS),
  time: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      'Time must use HH:mm format'
    ),
})

export const updateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(5, 'Please enter a valid phone number'),

  additionalPhone: z.string().trim().optional(),

  address: z
    .string()
    .trim()
    .min(3, 'Please enter your address'),

  bloodType: z.enum(BLOOD_TYPES).nullable().optional(),

  dateOfBirth: z
    .string()
    .trim()
    .refine(isValidIsoDate, 'Invalid date of birth')
    .optional(),

  weight: z.coerce
    .number()
    .positive('Weight must be a positive number'),

  height: z.coerce
    .number()
    .positive('Height must be a positive number'),

  donationIntervalDays: z.coerce
    .number()
    .int()
    .min(1, 'Interval must be at least 1 day')
    .max(365, 'Interval cannot exceed 365 days')
    .optional(),

  consentToContact: z.boolean().optional(),

  shareLocation: z.boolean().optional(),

  matchingOptOut: z.boolean().optional(),
})

export const updateAvailabilitySchema = z.object({
  currentAvailability: z.enum([
    'AVAILABLE',
    'UNAVAILABLE',
  ]),

  availabilities: z
    .array(availabilityEntrySchema)
    .max(7, 'You can select at most 7 days')
    .default([]),
})

export const createDonationRecordSchema = z.object({
  donatedAt: z
    .string()
    .trim()
    .refine(isValidIsoDate, 'Invalid donation date'),

  facilityName: z.string().trim().max(200).optional(),

  units: optionalNumber(z.number().positive().max(10)),

  notes: z.string().trim().max(500).optional(),
})

export const uploadReportSchema = z.object({
  reportType: z.enum(['IMAGE', 'PDF']),
})

export const DONOR_REVIEW_DECISIONS = [
  'VERIFY',
  'REJECT',
  'REQUEST_INFO',
] as const

export const reviewDonorVerificationSchema = z
  .object({
    decision: z.enum(DONOR_REVIEW_DECISIONS),

    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) =>
      value.decision === 'VERIFY' ||
      Boolean(value.notes && value.notes.length > 0),
    {
      message:
        'A reason is required to reject or request more information',
      path: ['notes'],
    }
  )

export type DonorReviewDecision =
  (typeof DONOR_REVIEW_DECISIONS)[number]

export type ReviewDonorVerificationInput = z.infer<
  typeof reviewDonorVerificationSchema
>

export type UpdateProfileInput = z.infer<
  typeof updateProfileSchema
>

export type UpdateAvailabilityInput = z.infer<
  typeof updateAvailabilitySchema
>

export type CreateDonationRecordInput = z.infer<
  typeof createDonationRecordSchema
>
