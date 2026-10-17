import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as bloodRequestController from '../controllers/blood-request.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', bloodRequestController.getRequests)
router.post('/', bloodRequestController.postRequest)

router.get('/:id', bloodRequestController.getRequest)
router.patch(
  '/:id/status',
  bloodRequestController.patchRequestStatus
)
router.delete('/:id', bloodRequestController.removeRequest)

export default router
