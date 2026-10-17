import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import { handleMedicalReportUpload } from '../middleware/upload.middleware'
import * as donorController from '../controllers/donor.controller'

const router = Router()

router.use(authenticateToken)

router.get('/dashboard', donorController.getDashboard)

router.get('/profile', donorController.getProfile)
router.put('/profile', donorController.putProfile)

router.get('/availability', donorController.getProfile)
router.put('/availability', donorController.putAvailability)

router.get('/eligibility', donorController.getEligibility)

router.get('/reports', donorController.getReports)
router.post(
  '/reports',
  handleMedicalReportUpload,
  donorController.postReport
)
router.get('/reports/:id/file', donorController.getReportFile)

router.get('/history', donorController.getHistory)
router.post('/history', donorController.postHistory)

router.get(
  '/registrations',
  donorController.getDonorRegistrations
)
router.patch(
  '/registrations/:id/verification',
  donorController.reviewDonorRegistration
)

export default router
