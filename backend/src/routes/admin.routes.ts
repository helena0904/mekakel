import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import { requireAdmin } from '../middleware/authorize.middleware'
import * as adminController from '../controllers/admin.controller'

const router = Router()

router.use(authenticateToken, requireAdmin)

router.get(
  '/hospitals',
  adminController.getHospitalApprovals
)
router.post(
  '/hospitals/:id/review',
  adminController.reviewHospitalRegistration
)

router.get('/users', adminController.getUsers)
router.patch('/users/:id', adminController.patchUser)

router.get(
  '/review-assignments',
  adminController.getReviewAssignments
)
router.post(
  '/donor-reviews/:id/assignment',
  adminController.postReviewAssignment
)

router.get('/audit-logs', adminController.getAuditLogs)

router.get('/settings', adminController.getSettings)
router.put('/settings', adminController.putSettings)

export default router
