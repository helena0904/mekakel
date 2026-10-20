import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as hospitalController from '../controllers/hospital.controller'

const router = Router()

router.use(authenticateToken)

router.get('/dashboard', hospitalController.getDashboard)

router.get('/profile', hospitalController.getProfile)
router.put('/profile', hospitalController.putProfile)

router.get('/search', hospitalController.searchNearby)

router.get('/staff', hospitalController.getStaff)
router.post('/staff', hospitalController.postStaff)
router.patch('/staff/:id', hospitalController.patchStaff)
router.delete('/staff/:id', hospitalController.removeStaff)

router.get(
  '/admin/hospitals',
  hospitalController.getHospitalRegistrations
)
router.post(
  '/admin/hospitals/:id/review',
  hospitalController.reviewHospitalRegistration
)

export default router
