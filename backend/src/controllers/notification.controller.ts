import type { Response } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'
import {
  countUnreadNotifications,
  getPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updatePreferences,
} from '../services/notification.service'
import {
  listNotificationsQuerySchema,
  notificationIdSchema,
  updatePreferencesSchema,
} from '../validators/notification.schema'

function requireUser(
  req: AuthRequest,
  res: Response
): number | null {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' })
    return null
  }

  return req.user.userId
}

export async function getNotifications(
  req: AuthRequest,
  res: Response
) {
  const userId = requireUser(req, res)

  if (userId === null) {
    return
  }

  const parsed = listNotificationsQuerySchema.safeParse(
    req.query
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid notification filters',
    })
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(userId, parsed.data),
      countUnreadNotifications(userId),
    ])

    return res.status(200).json({
      notifications,
      unreadCount,
    })
  } catch (error) {
    console.error('List notifications error:', error)

    return res.status(500).json({
      message: 'Unable to load notifications',
    })
  }
}

export async function getUnreadCount(
  req: AuthRequest,
  res: Response
) {
  const userId = requireUser(req, res)

  if (userId === null) {
    return
  }

  try {
    const unreadCount = await countUnreadNotifications(userId)

    return res.status(200).json({ unreadCount })
  } catch (error) {
    console.error('Count notifications error:', error)

    return res.status(500).json({
      message: 'Unable to count notifications',
    })
  }
}

export async function patchMarkRead(
  req: AuthRequest,
  res: Response
) {
  const userId = requireUser(req, res)

  if (userId === null) {
    return
  }

  const parsed = notificationIdSchema.safeParse(req.params)

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid notification id',
    })
  }

  try {
    const notification = await markNotificationRead(
      userId,
      parsed.data.id
    )

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found',
      })
    }

    return res.status(200).json({
      message: 'Notification marked as read',
      notification,
    })
  } catch (error) {
    console.error('Mark notification read error:', error)

    return res.status(500).json({
      message: 'Unable to update the notification',
    })
  }
}

export async function postMarkAllRead(
  req: AuthRequest,
  res: Response
) {
  const userId = requireUser(req, res)

  if (userId === null) {
    return
  }

  try {
    const updated = await markAllNotificationsRead(userId)

    return res.status(200).json({
      message: 'All notifications marked as read',
      updated,
    })
  } catch (error) {
    console.error('Mark all notifications read error:', error)

    return res.status(500).json({
      message: 'Unable to update notifications',
    })
  }
}

export async function getNotificationPreferences(
  req: AuthRequest,
  res: Response
) {
  const userId = requireUser(req, res)

  if (userId === null) {
    return
  }

  try {
    const preferences = await getPreferences(userId)

    return res.status(200).json({ preferences })
  } catch (error) {
    console.error('Get notification preferences error:', error)

    return res.status(500).json({
      message: 'Unable to load notification preferences',
    })
  }
}

export async function putNotificationPreferences(
  req: AuthRequest,
  res: Response
) {
  const userId = requireUser(req, res)

  if (userId === null) {
    return
  }

  const parsed = updatePreferencesSchema.safeParse(
    req.body ?? {}
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid notification preferences',
    })
  }

  try {
    const preferences = await updatePreferences(
      userId,
      parsed.data
    )

    return res.status(200).json({
      message: 'Notification preferences updated',
      preferences,
    })
  } catch (error) {
    console.error(
      'Update notification preferences error:',
      error
    )

    return res.status(500).json({
      message: 'Unable to update notification preferences',
    })
  }
}
