import prisma from '../lib/prisma'
import {
  recordAudit,
  type AuditActor,
  type AuditActionValue,
} from './audit.service'
import type { UpdateUserInput } from '../validators/admin.schema'

export interface ListUsersQuery {
  role?: string
  accountType?: string
  search?: string
  isActive?: boolean
  limit?: number
}

const MAX_USERS_LIMIT = 200

const userSelect = {
  id: true,
  name: true,
  email: true,
  accountType: true,
  role: true,
  isActive: true,
  createdAt: true,
  passwordVersion: true,
} as const

export function listUsers(query: ListUsersQuery = {}) {
  const limit = Math.min(
    Math.max(query.limit ?? 100, 1),
    MAX_USERS_LIMIT,
  )

  return prisma.user.findMany({
    where: {
      role: query.role as never,
      accountType: query.accountType as never,
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: userSelect,
  })
}

export async function findUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })
}

export async function updateUser(
  userId: number,
  data: UpdateUserInput,
  actor: AuditActor = {},
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  })

  if (!existing) {
    return null
  }

  const roleChanged =
    data.role !== undefined && data.role !== existing.role
  const statusChanged =
    data.isActive !== undefined &&
    data.isActive !== existing.isActive

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role: data.role,
        isActive: data.isActive,
      },
      select: userSelect,
    })

    // Changing a role or status invalidates the user's existing sessions.
    if (roleChanged || statusChanged) {
      await tx.user.update({
        where: { id: userId },
        data: { passwordVersion: { increment: 1 } },
      })
    }

    const action: AuditActionValue = roleChanged
      ? 'USER_ROLE_CHANGED'
      : 'USER_STATUS_CHANGED'

    const summary = roleChanged
      ? `User role changed from ${existing.role} to ${data.role}`
      : `User account ${
          data.isActive ? 'activated' : 'deactivated'
        }`

    await recordAudit(
      {
        ...actor,
        action,
        entityType: 'User',
        entityId: userId,
        summary,
        metadata: {
          before: {
            role: existing.role,
            isActive: existing.isActive,
          },
          after: {
            role: updated.role,
            isActive: updated.isActive,
          },
        },
      },
      tx,
    )

    return updated
  })
}
