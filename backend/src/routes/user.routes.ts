import { Router } from 'express'
import prisma from '../lib/prisma'
import {
  authenticateToken,
  AuthRequest,
} from '../middleware/auth.middleware'

const router = Router()

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: 'Unauthorized',
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      include: {
        donorProfile: {
          include: {
            availabilities: true,
          },
        },
        hospitalProfile: true,
      },
    })

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      })
    }

    return res.json({
      message: 'Authenticated user',
      user,
    })
  } catch (error) {
    console.error('Get current user error:', error)

    return res.status(500).json({
      message: 'Internal server error',
    })
  }
})

export default router
