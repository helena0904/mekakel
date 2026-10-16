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
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        role: true,
        isActive: true,
        createdAt: true,

        donorProfile: {
          select: {
            id: true,
            phone: true,
            address: true,
            bloodType: true,
            verificationStatus: true,
            currentAvailability: true,
            availabilities: {
              select: {
                day: true,
                time: true,
              },
            },
          },
        },

        hospitalProfile: {
          select: {
            id: true,
            hospitalName: true,
            address: true,
            phone: true,
            isVerified: true,
          },
        },
      },
    })

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      })
    }

    return res.status(200).json({
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