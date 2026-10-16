import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { PostgresRateLimitStore } from '../lib/rate-limit-store'
import { verifyFayda } from '../controllers/fayda.controller'

const router = Router()

const faydaVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('fayda-verify'),
  message: {
    success: false,
    simulated: true,
    message:
      'Too many verification attempts. Please try again after 15 minutes.',
    identity: null,
  },
})

router.post(
  '/verify',
  faydaVerificationLimiter,
  verifyFayda
)

export default router