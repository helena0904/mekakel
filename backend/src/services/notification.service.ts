import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import { renderWorkflowEmail, sendEmail } from './email.service'
import type { WorkflowEmailContext } from './email.service'
import { categoryForType } from '../validators/notification.schema'
import type {
  ListNotificationsQuery,
  NotificationCategoryValue,
  NotificationStatusValue,
  NotificationTypeValue,
  UpdatePreferencesInput,
} from '../validators/notification.schema'

export const DEFAULT_MAX_ATTEMPTS = 3

// Base backoff applied between delivery attempts. The actual delay grows
// linearly with the attempt count so a failing SMTP server is not hammered.
export const NOTIFICATION_RETRY_DELAY_MS = 60_000

export type NotificationRecord = Prisma.NotificationGetPayload<{}>

export interface NotificationPreferences {
  emailEnabled: boolean
  donorUpdates: boolean
  hospitalUpdates: boolean
  reservationUpdates: boolean
  transferUpdates: boolean
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  donorUpdates: true,
  hospitalUpdates: true,
  reservationUpdates: true,
  transferUpdates: true,
}

function categoryColumn(
  category: NotificationCategoryValue
): keyof NotificationPreferences {
  switch (category) {
    case 'DONOR':
      return 'donorUpdates'
    case 'HOSPITAL':
      return 'hospitalUpdates'
    case 'RESERVATION':
      return 'reservationUpdates'
    case 'TRANSFER':
      return 'transferUpdates'
  }
}

function serializePreferences(
  preference: {
    emailEnabled: boolean
    donorUpdates: boolean
    hospitalUpdates: boolean
    reservationUpdates: boolean
    transferUpdates: boolean
  } | null
): NotificationPreferences {
  if (!preference) {
    return { ...DEFAULT_PREFERENCES }
  }

  return {
    emailEnabled: preference.emailEnabled,
    donorUpdates: preference.donorUpdates,
    hospitalUpdates: preference.hospitalUpdates,
    reservationUpdates: preference.reservationUpdates,
    transferUpdates: preference.transferUpdates,
  }
}

export async function getPreferences(
  userId: number
): Promise<NotificationPreferences> {
  const preference =
    await prisma.notificationPreference.findUnique({
      where: { userId },
    })

  return serializePreferences(preference)
}

export async function updatePreferences(
  userId: number,
  data: UpdatePreferencesInput
): Promise<NotificationPreferences> {
  const preference =
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data },
    })

  return serializePreferences(preference)
}

export interface QueueNotificationInput {
  userId: number
  type: NotificationTypeValue
  context?: WorkflowEmailContext
  dedupeKey?: string
  relatedEntityType?: string
  relatedEntityId?: number
  scheduledAt?: Date
  maxAttempts?: number
}

/**
 * Persists a notification for a user. Delivery happens later (in the job or
 * via deliverNotification) so a transient SMTP outage never fails the
 * business action that triggered the message.
 *
 * Honours the recipient's notification preferences: if the relevant category
 * (or all email) is disabled, the record is stored as SUPPRESSED for audit and
 * is never sent.
 */
export async function queueNotification(
  input: QueueNotificationInput
): Promise<NotificationRecord | null> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return null
  }

  const category = categoryForType(input.type)
  const preferences = await getPreferences(user.id)
  const enabled =
    preferences.emailEnabled &&
    preferences[categoryColumn(category)]

  const rendered = renderWorkflowEmail(input.type, {
    recipientName: user.name,
    ...input.context,
  })

  const data: Prisma.NotificationUncheckedCreateInput = {
    userId: user.id,
    recipientEmail: user.email,
    type: input.type,
    category,
    subject: rendered.subject,
    body: rendered.text,
    html: rendered.html,
    status: enabled ? 'PENDING' : 'SUPPRESSED',
    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    dedupeKey: input.dedupeKey ?? null,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    scheduledAt: input.scheduledAt ?? new Date(),
  }

  try {
    return await prisma.notification.create({ data })
  } catch (error) {
    // A duplicate dedupeKey means the same event was already queued.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      input.dedupeKey
    ) {
      return prisma.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
      })
    }

    throw error
  }
}

export async function notifyUser(
  userId: number,
  type: NotificationTypeValue,
  context: WorkflowEmailContext = {},
  meta: Partial<QueueNotificationInput> = {}
): Promise<NotificationRecord | null> {
  return queueNotification({
    userId,
    type,
    context,
    ...meta,
  })
}

export async function notifyHospitalOwner(
  hospitalProfileId: number,
  type: NotificationTypeValue,
  context: WorkflowEmailContext = {},
  meta: Partial<QueueNotificationInput> = {}
): Promise<NotificationRecord | null> {
  const hospital = await prisma.hospitalProfile.findUnique({
    where: { id: hospitalProfileId },
    select: { userId: true, hospitalName: true },
  })

  if (!hospital) {
    return null
  }

  return queueNotification({
    userId: hospital.userId,
    type,
    context: {
      hospitalName: hospital.hospitalName,
      ...context,
    },
    ...meta,
  })
}

export interface DeliveryResult {
  status: NotificationStatusValue
  attempts: number
}

/**
 * Attempts to deliver one pending notification. On failure the attempt count
 * and last error are recorded; the notification is rescheduled for a retry
 * until maxAttempts is exhausted, then marked FAILED.
 */
export async function deliverNotification(
  notificationId: number,
  now: Date = new Date()
): Promise<DeliveryResult> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  })

  if (!notification) {
    return { status: 'FAILED', attempts: 0 }
  }

  if (notification.status !== 'PENDING') {
    return {
      status:
        notification.status as NotificationStatusValue,
      attempts: notification.attempts,
    }
  }

  const attempts = notification.attempts + 1

  try {
    await sendEmail({
      to: notification.recipientEmail,
      subject: notification.subject,
      text: notification.body,
      ...(notification.html
        ? { html: notification.html }
        : {}),
    })

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        attempts,
        sentAt: now,
        lastAttemptAt: now,
        lastError: null,
      },
    })

    return { status: 'SENT', attempts }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)

    const failed = attempts >= notification.maxAttempts

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: failed ? 'FAILED' : 'PENDING',
        attempts,
        lastAttemptAt: now,
        lastError: message,
        ...(failed
          ? {}
          : {
              scheduledAt: new Date(
                now.getTime() +
                  NOTIFICATION_RETRY_DELAY_MS * attempts
              ),
            }),
      },
    })

    return {
      status: failed ? 'FAILED' : 'PENDING',
      attempts,
    }
  }
}

export interface ProcessNotificationsResult {
  processed: number
  sent: number
  failed: number
  pending: number
}

export async function processPendingNotifications(
  options: { limit?: number; now?: Date } = {}
): Promise<ProcessNotificationsResult> {
  const limit = options.limit ?? 50
  const now = options.now ?? new Date()

  const due = await prisma.notification.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: { id: true },
  })

  const result: ProcessNotificationsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  }

  for (const { id } of due) {
    const outcome = await deliverNotification(id, now)

    result.processed += 1

    if (outcome.status === 'SENT') {
      result.sent += 1
    } else if (outcome.status === 'FAILED') {
      result.failed += 1
    } else {
      result.pending += 1
    }
  }

  return result
}

export async function listNotifications(
  userId: number,
  query: ListNotificationsQuery = {}
): Promise<NotificationRecord[]> {
  const where: Prisma.NotificationWhereInput = { userId }

  if (query.status) {
    where.status = query.status
  }

  if (query.category) {
    where.category = query.category
  }

  if (query.unreadOnly) {
    where.readAt = null
  }

  return prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit ?? 50,
  })
}

export function countUnreadNotifications(
  userId: number
): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  })
}

export async function markNotificationRead(
  userId: number,
  notificationId: number
): Promise<NotificationRecord | null> {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, readAt: true },
  })

  if (!existing) {
    return null
  }

  if (existing.readAt) {
    return prisma.notification.findUnique({
      where: { id: notificationId },
    })
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  })
}

export async function markAllNotificationsRead(
  userId: number
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })

  return result.count
}
