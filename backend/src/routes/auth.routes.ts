import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../lib/prisma'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  accountType: z.enum(['INDIVIDUAL', 'HOSPITAL']),
})

router.post('/register', async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid registration data',
        errors: result.error.issues,
      })
    }

    const { email, password, name, accountType } = result.data

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(409).json({
        message: 'Email is already registered',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const role = accountType === 'INDIVIDUAL'
      ? 'DONOR'
      : 'HOSPITAL_STAFF'

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        accountType,
        role,
      },
    })

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        role: user.role,
      },
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Something went wrong',
    })
  }
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  accountType: z.enum(['INDIVIDUAL', 'HOSPITAL']),
})

router.post('/login', async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid login data',
        errors: result.error.issues,
      })
    }

    const { email, password, accountType } = result.data

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    if (user.accountType !== accountType) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is inactive',
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    const secret = process.env.JWT_SECRET

    if (!secret) {
      return res.status(500).json({
        message: 'JWT secret is not configured',
      })
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        accountType: user.accountType,
      },
      secret,
      {
        expiresIn: '1h',
      }
    )

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        role: user.role,
      },
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Something went wrong',
    })
  }
})

export default router