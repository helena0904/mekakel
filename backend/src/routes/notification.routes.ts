import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as notificationController from '../controllers/notification.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', notificationController.getNotifications)

router.get(
  '/unread-count',
  notificationController.getUnreadCount
)

router.post(
  '/read-all',
  notificationController.postMarkAllRead
)

router.get(
  '/preferences',
  notificationController.getNotificationPreferences
)
router.put(
  '/preferences',
  notificationController.putNotificationPreferences
)

router.patch(
  '/:id/read',
  notificationController.patchMarkRead
)

export default router
