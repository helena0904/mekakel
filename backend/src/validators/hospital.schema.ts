import { z } from 'zod'

export const HOSPITAL_STAFF_ROLES = [
  'ADMIN',
  'MANAGER',
  'TECHNICIAN',
  'VIEWER',
] as const

export const hospitalStatuses = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const

const passwordSchema = z
  .string()
  .min(8, 'Password must have at least 8 characters')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password is too long'
  )
  .refine(
    (value) => /[A-Z]/.test(value),
    'Password must include an uppercase letter'
  )
  .refine(
    (value) => /[a-z]/.test(value),
    'Password must include a lowercase letter'
  )
  .refine(
    (value) => /[0-9]/.test(value),
    'Password must include a number'
  )
  .refine(
    (value) => /[^A-Za-z0-9]/.test(value),
    'Password must include a special character'
  )

export const updateHospitalProfileSchema = z.object({
  hospitalName: z
    .string()
    .trim()
    .min(2, 'Please enter the hospital name'),

  address: z
    .string()
    .trim()
    .min(3, 'Please enter the hospital address'),

  phone: z
    .string()
    .trim()
    .min(5, 'Please enter a valid phone number'),

  additionalPhone: z.string().trim().optional(),
})

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, 'Please enter the staff name'),

  email: z.string().trim().toLowerCase().email(),

  password: passwordSchema,

  staffRole: z.enum(HOSPITAL_STAFF_ROLES),
})

export const updateStaffSchema = z
  .object({
    staffRole: z.enum(HOSPITAL_STAFF_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.staffRole !== undefined ||
      value.isActive !== undefined,
    'Nothing to update'
  )

export const reviewHospitalSchema = z.object({
  decision: z.enum([
    'APPROVE',
    'REJECT',
    'SUSPEND',
    'ACTIVATE',
  ]),

  notes: z.string().trim().max(500).optional(),
})

export type UpdateHospitalProfileInput = z.infer<
  typeof updateHospitalProfileSchema
>

export type CreateStaffInput = z.infer<
  typeof createStaffSchema
>

export type UpdateStaffInput = z.infer<
  typeof updateStaffSchema
>

export type ReviewHospitalInput = z.infer<
  typeof reviewHospitalSchema
>
