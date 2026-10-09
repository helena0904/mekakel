import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { handleMedicalReportUpload } from '../middleware/upload.middleware'

const router = Router()

const availabilitySchema = z.object({
  day: z.enum([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ]),
  time: z.string().regex(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
    'Time must be in HH:mm format'
  ),
})

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      value === '' || value === null || value === undefined
        ? undefined
        : Number(value),
    schema.optional()
  )

const optionalDate = z.preprocess(
  (value) =>
    value === '' || value === null || value === undefined
      ? undefined
      : value,
  z
    .string()
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      'Invalid donation date'
    )
    .optional()
)

const optionalAvailabilities = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined
    }

    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }

    return value
  },
  z.array(availabilitySchema).max(7).optional()
)

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(2),
  accountType: z.enum(['INDIVIDUAL', 'HOSPITAL']),

  faydaId: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'Fayda ID must be exactly 16 digits')
    .optional(),
  phone: z.string().optional(),
  additionalPhone: z.string().optional(),
  address: z.string().optional(),

  age: optionalNumber(z.number().int().min(18)),
  weight: optionalNumber(z.number().positive()),
  height: optionalNumber(z.number().positive()),

  currentAvailability: z
    .enum(['AVAILABLE', 'UNAVAILABLE'])
    .optional(),

  lastDonation: optionalDate,

  availabilities: optionalAvailabilities,

  reportType: z.enum(['IMAGE', 'PDF']).optional(),

  hospitalName: z.string().optional(),
})

router.post(
  '/register',
  handleMedicalReportUpload,
  async (req, res) => {
    res.on('finish', () => {
      if (req.file && res.statusCode >= 400) {
        fs.unlink(req.file.path, () => {})
      }
    })

    try {
      const result = registerSchema.safeParse(req.body)

      if (!result.success) {
        return res.status(400).json({
          message: 'Invalid registration data',
          errors: result.error.issues,
        })
      }

      const data = result.data

      const existingUser = await prisma.user.findUnique({
        where: {
          email: data.email,
        },
      })

      if (existingUser) {
        return res.status(409).json({
          message: 'Email is already registered',
        })
      }

      if (data.accountType === 'INDIVIDUAL') {
        if (
          !data.faydaId ||
          !data.phone ||
          !data.address ||
          data.age === undefined ||
          data.weight === undefined ||
          data.height === undefined
        ) {
          return res.status(400).json({
            message: 'Missing required donor information',
          })
        }

        const file = req.file

        if (!file || !data.reportType) {
          return res.status(400).json({
            message: 'Please upload your medical report.',
          })
        }

        const typeMatches =
          data.reportType === 'PDF'
            ? file.mimetype === 'application/pdf'
            : file.mimetype.startsWith('image/')

        if (!typeMatches) {
          return res.status(400).json({
            message:
              'Medical report does not match the selected file type',
          })
        }
      }

      if (data.accountType === 'HOSPITAL') {
        if (
          !data.hospitalName ||
          !data.address ||
          !data.phone
        ) {
          return res.status(400).json({
            message: 'Missing required hospital information',
          })
        }

        if (req.file) fs.unlink(req.file.path, () => {})
      }

      const selectedDays = data.availabilities ?? []

      const days = selectedDays.map(
        (availability) => availability.day
      )

      if (new Set(days).size !== days.length) {
        return res.status(400).json({
          message: 'A day can only be selected once',
        })
      }

      const passwordHash = await bcrypt.hash(
        data.password,
        10
      )

      const role =
        data.accountType === 'INDIVIDUAL'
          ? 'DONOR'
          : 'HOSPITAL_STAFF'

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: data.email,
            passwordHash,
            name: data.name,
            accountType: data.accountType,
            role,

            ...(data.accountType === 'INDIVIDUAL'
              ? {
                  donorProfile: {
                    create: {
                      faydaId: data.faydaId || null,
                      phone: data.phone!,
                      additionalPhone:
                        data.additionalPhone || null,
                      address: data.address!,
                      age: data.age!,
                      weight: data.weight!,
                      height: data.height!,
                      currentAvailability:
                        data.currentAvailability ??
                        'UNAVAILABLE',
                      lastDonation: data.lastDonation
                        ? new Date(data.lastDonation)
                        : null,

                      availabilities: {
                        create: selectedDays.map(
                          (availability) => ({
                            day: availability.day,
                            time: availability.time,
                          })
                        ),
                      },
                    },
                  },
                }
              : {
                  hospitalProfile: {
                    create: {
                      hospitalName: data.hospitalName!,
                      address: data.address!,
                      phone: data.phone!,
                      additionalPhone:
                        data.additionalPhone || null,
                      isVerified: false,
                    },
                  },
                }),
          },
          include: { donorProfile: true },
        })

        if (data.accountType === 'INDIVIDUAL') {
          await tx.medicalReport.create({
            data: {
              donorProfileId: created.donorProfile!.id,
              uploadedByUserId: created.id,
              reportType: data.reportType!,
              fileUrl: req.file!.filename,
            },
          })
        }

        return created
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(409).json({
          message: 'Email or Fayda ID is already registered',
        })
      }

      console.error('Registration error:', error)

return res.status(500).json({
  message:
    error instanceof Error
      ? error.message
      : 'Unknown registration error',
})
    }
  }
)

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

    if (!user || user.accountType !== accountType) {
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