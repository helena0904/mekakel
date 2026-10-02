import { Router } from 'express'
import {
  authenticateToken,
  AuthRequest,
} from '../middleware/auth.middleware'

const router = Router()

router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  return res.json({
    message: 'Authenticated user',
    user: req.user,
  })
})

export default router