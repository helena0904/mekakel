import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import { requireDoctor } from '../middleware/authorize.middleware'
import * as doctorController from '../controllers/doctor.controller'

const router = Router()

router.use(authenticateToken, requireDoctor)

router.get(
  '/verifications',
  doctorController.getVerificationQueue
)
router.get(
  '/verifications/:id',
  doctorController.getVerification
)
router.post(
  '/verifications/:id/decision',
  doctorController.postVerificationDecision
)

router.get(
  '/reports/:id/file',
  doctorController.getReportFile
)

export default router
