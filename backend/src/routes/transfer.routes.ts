import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as transferController from '../controllers/transfer.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', transferController.getTransfers)
router.post('/', transferController.postTransfer)

router.get(
  '/destinations',
  transferController.getTransferDestinations
)

router.get('/:id', transferController.getTransfer)
router.post(
  '/:id/approve',
  transferController.postApproveTransfer
)
router.post(
  '/:id/reject',
  transferController.postRejectTransfer
)
router.post(
  '/:id/dispatch',
  transferController.postDispatchTransfer
)
router.post(
  '/:id/receive',
  transferController.postReceiveTransfer
)
router.post(
  '/:id/complete',
  transferController.postCompleteTransfer
)
router.post(
  '/:id/cancel',
  transferController.postCancelTransfer
)

export default router
