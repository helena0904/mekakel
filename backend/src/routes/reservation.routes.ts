import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as reservationController from '../controllers/reservation.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', reservationController.getReservations)
router.post('/', reservationController.postReservation)

router.get(
  '/donor',
  reservationController.getDonorReservations
)

router.get('/:id', reservationController.getReservation)
router.post(
  '/:id/confirm',
  reservationController.postConfirmReservation
)
router.post(
  '/:id/cancel',
  reservationController.postCancelReservation
)
router.post(
  '/:id/release',
  reservationController.postReleaseReservation
)
router.post(
  '/:id/consume',
  reservationController.postConsumeReservation
)
router.patch(
  '/:id/donor-response',
  reservationController.patchDonorResponse
)

export default router
