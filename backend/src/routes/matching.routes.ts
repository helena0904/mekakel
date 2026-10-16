import { Router } from 'express'

import { authenticateToken } from '../middleware/auth.middleware'
import * as matchingController from '../controllers/matching.controller'

const router = Router()

router.use(authenticateToken)

router.get(
  '/requests/:id/matches',
  matchingController.getRequestMatches
)

export default router
