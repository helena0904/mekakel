import {
  Prisma,
  AuditAction,
  UserRole,
} from '@prisma/client'

import prisma from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth.middleware'

export type AuditActionValue = AuditAction

export type AuditRoleValue = UserRole

export type AuditLogRecord = Prisma.AuditLogGetPayload<{}>

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>

export interface AuditActor {
  userId?: number | null
  name?: string | null
  role?: AuditRoleValue | null
  ipAddress?: string | null
}

// Builds an audit actor from the authenticated request. Controllers pass the
// result into services so decisions carry the responsible user and timestamp.
export function actorFromRequest(
  req: AuthRequest,
): AuditActor {
  return {
    userId: req.user?.userId ?? null,
    name: req.user?.name ?? null,
    role: (req.user?.role as AuditRoleValue) ?? null,
    ipAddress: req.ip ?? null,
  }
}

export interface RecordAuditInput extends AuditActor {
  action: AuditActionValue
  entityType: string
  entityId?: number | null
  summary: string
  metadata?: Prisma.InputJsonValue | null
}

export interface ListAuditLogsQuery {
  action?: AuditActionValue
  entityType?: string
  entityId?: number
  actorUserId?: number
  limit?: number
}

// Writes an audit entry. When a transaction client is supplied the write is
// atomic with the decision it records; otherwise the default client is used.
export async function recordAudit(
  input: RecordAuditInput,
  client: AuditClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorUserId: input.userId ?? null,
      actorName: input.name ?? null,
      actorRole: input.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? Prisma.JsonNull,
      ipAddress: input.ipAddress ?? null,
    },
  })
}

// Best-effort variant for secondary activity logging where a failed audit
// write must not roll back an already-completed business action.
export async function recordAuditSafely(
  input: RecordAuditInput,
): Promise<void> {
  try {
    await recordAudit(input)
  } catch (error) {
    console.error('Unable to record audit entry:', error)
  }
}

export const MAX_AUDIT_LIMIT = 200

export async function listAuditLogs(
  query: ListAuditLogsQuery = {},
): Promise<AuditLogRecord[]> {
  const limit = Math.min(
    Math.max(query.limit ?? 100, 1),
    MAX_AUDIT_LIMIT,
  )

  return prisma.auditLog.findMany({
    where: {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })
}
