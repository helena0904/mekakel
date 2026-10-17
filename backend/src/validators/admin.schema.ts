import { z } from 'zod'

export const USER_ROLES = [
  'DONOR',
  'HOSPITAL_STAFF',
  'DOCTOR',
  'ADMIN',
  'USER',
] as const

export const ACCOUNT_TYPES = [
  'INDIVIDUAL',
  'HOSPITAL',
] as const

export const AUDIT_ACTIONS = [
  'DONOR_VERIFICATION_DECIDED',
  'HOSPITAL_REGISTRATION_DECIDED',
  'USER_ROLE_CHANGED',
  'USER_STATUS_CHANGED',
  'SETTINGS_UPDATED',
  'INVENTORY_UNIT_CREATED',
  'INVENTORY_UNIT_UPDATED',
  'INVENTORY_UNIT_DELETED',
  'RESERVATION_CREATED',
  'RESERVATION_CONFIRMED',
  'RESERVATION_CANCELLED',
  'RESERVATION_RELEASED',
  'RESERVATION_CONSUMED',
  'RESERVATION_EXPIRED',
  'TRANSFER_REQUESTED',
  'TRANSFER_APPROVED',
  'TRANSFER_REJECTED',
  'TRANSFER_DISPATCHED',
  'TRANSFER_RECEIVED',
  'TRANSFER_COMPLETED',
  'TRANSFER_CANCELLED',
] as const

export type UserRoleInput = (typeof USER_ROLES)[number]
export type AuditActionInput = (typeof AUDIT_ACTIONS)[number]

const booleanFromQuery = z.preprocess((value) => {
  if (value === 'true' || value === true) {
    return true
  }

  if (value === 'false' || value === false) {
    return false
  }

  return undefined
}, z.boolean().optional())

const positiveIntFromQuery = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return Number(value)
}, z.number().int().positive().optional())

export const listUsersQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  isActive: booleanFromQuery,
  limit: positiveIntFromQuery,
})

export const VERIFICATION_STATUSES = [
  'PENDING',
  'ADDITIONAL_INFO_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'ALL',
] as const

export const listVerificationQueueQuerySchema = z.object({
  status: z.enum(VERIFICATION_STATUSES).optional(),
  limit: positiveIntFromQuery,
})

export const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.role !== undefined || value.isActive !== undefined,
    {
      message: 'Provide a role or account status to update',
    }
  )

export const listAuditLogsQuerySchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.string().trim().min(1).max(60).optional(),
  entityId: positiveIntFromQuery,
  actorUserId: positiveIntFromQuery,
  limit: positiveIntFromQuery,
})

const eligibilitySchema = z
  .object({
    minAge: z.number().int().min(0).max(120).optional(),
    maxAge: z.number().int().min(0).max(120).optional(),
    minWeightKg: z.number().positive().max(300).optional(),
  })
  .refine(
    (value) =>
      value.minAge === undefined ||
      value.maxAge === undefined ||
      value.minAge <= value.maxAge,
    {
      message: 'Minimum age cannot exceed the maximum age',
      path: ['minAge'],
    }
  )

const compatibilitySchema = z.object({
  enforceRh: z.boolean().optional(),
  plasmaReversed: z.boolean().optional(),
})

export const updateSettingsSchema = z
  .object({
    eligibility: eligibilitySchema.optional(),
    compatibility: compatibilitySchema.optional(),
  })
  .refine(
    (value) =>
      value.eligibility !== undefined ||
      value.compatibility !== undefined,
    {
      message: 'Provide eligibility or compatibility settings',
    }
  )

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ListAuditLogsQueryInput = z.infer<
  typeof listAuditLogsQuerySchema
>
export type UpdateSettingsInput = z.infer<
  typeof updateSettingsSchema
>
