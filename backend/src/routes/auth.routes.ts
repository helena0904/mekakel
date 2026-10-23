import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import { PostgresRateLimitStore } from '../lib/rate-limit-store'
import { verifyMockFayda } from '../services/fayda.service'
import { handleMedicalReportUpload } from '../middleware/upload.middleware'
import { sendPasswordResetEmail } from '../services/email.service'
import {
  deliverNotification,
  queueNotification,
} from '../services/notification.service'
import {
  activationNotes,
  computeDonationActivation,
} from '../services/eligibility.service'
import { composeAddress } from '../services/donor.service'
import {
  availabilityEntrySchema,
  normalizeAvailability,
} from '../validators/donor.schema'
import {
  authenticateToken,
  type AuthRequest,
} from '../middleware/auth.middleware'

const router = Router()

const RESET_EXPIRY_MINUTES = 15

const GENERIC_RESET_MESSAGE =
  'If an account exists with that email, a password reset link will be sent.'

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('register'),
  message: {
    message: 'Too many registration attempts. Please try again later.',
  },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('login'),
  message: {
    message: 'Too many login attempts. Please try again later.',
  },
})

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('forgot-password'),
  message: {
    message: 'Too many password reset requests. Please try again later.',
  },
})

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('reset-password'),
  message: {
    message: 'Too many reset attempts. Please try again later.',
  },
})

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(value)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

function getAge(dateOfBirth: Date): number {
  const today = new Date()

  let age =
    today.getUTCFullYear() -
    dateOfBirth.getUTCFullYear()

  if (
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (
      today.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      today.getUTCDate() < dateOfBirth.getUTCDate()
    )
  ) {
    age--
  }

  return age
}

function hashResetToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

async function sendPasswordResetEmailWithRetry(
  email: string,
  token: string,
  attempts = 3
): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sendPasswordResetEmail(email, token)
      return
    } catch (error) {
      lastError = error

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 250 * attempt)
        )
      }
    }
  }

  throw lastError
}

const passwordSchema = z.string()
  .min(8, 'Password must have at least 8 characters')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password is too long'
  )
  .refine(
    (value) => /[A-Z]/.test(value),
    'Password must include an uppercase letter'
  )
  .refine(
    (value) => /[a-z]/.test(value),
    'Password must include a lowercase letter'
  )
  .refine(
    (value) => /[0-9]/.test(value),
    'Password must include a number'
  )
  .refine(
    (value) => /[^A-Za-z0-9]/.test(value),
    'Password must include a special character'
  )

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      value === '' || value == null
        ? undefined
        : Number(value),
    schema.optional()
  )

const optionalDate = z.preprocess(
  (value) =>
    value === '' || value == null
      ? undefined
      : value,
  z.string()
    .refine(isValidDate, 'Invalid date')
    .optional()
)

const availabilityList = z.preprocess(
  (value) => {
    if (value === '' || value == null) {
      return undefined
    }

    if (typeof value !== 'string') {
      return value
    }

    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  },
  z.array(availabilityEntrySchema).max(7).optional()
)

const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  accountType: z.enum(['INDIVIDUAL', 'HOSPITAL']),
  registrationType: z
    .enum(['DONOR', 'HOSPITAL', 'DOCTOR'])
    .optional(),

  faydaId: z.string()
    .trim()
    .regex(/^\d{16}$/)
    .optional(),

  // Clinical reviewer details
  licenseNumber: z.string().trim().min(3).max(60).optional(),
  specialization: z.string().trim().min(2).max(120).optional(),
  institution: z.string().trim().min(2).max(180).optional(),

  dateOfBirth: optionalDate,
  phone: z.string().trim().optional(),
  additionalPhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  subcity: z.string().trim().max(120).optional(),
  wereda: z.string().trim().max(120).optional(),

  age: optionalNumber(z.number().int().min(18)),
  weight: optionalNumber(z.number().positive()),
  height: optionalNumber(z.number().positive()),

  currentAvailability: z.enum([
    'AVAILABLE',
    'UNAVAILABLE',
  ]).optional(),

  lastDonation: optionalDate,
  availabilities: availabilityList,
  reportType: z.enum(['IMAGE', 'PDF']).optional(),
  hospitalName: z.string().trim().optional(),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  accountType: z.enum(['INDIVIDUAL', 'HOSPITAL']),
})

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: passwordSchema,
})

router.post(
  '/register',
  registerLimiter,
  handleMedicalReportUpload,
  async (req, res) => {
    res.on('finish', () => {
      if (req.file && res.statusCode >= 400) {
        fs.unlink(req.file.path, () => {})
      }
    })

    try {
      const parsed = registerSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid registration data',
          errors: parsed.error.issues,
        })
      }

      const data = parsed.data
      const file = req.file

      const donorAddress =
        composeAddress(data.wereda, data.subcity) ??
        data.address ??
        null

      const registrationType =
        data.registrationType ??
        (data.accountType === 'HOSPITAL' ? 'HOSPITAL' : 'DONOR')

      if (registrationType === 'DOCTOR') {
        if (data.accountType !== 'INDIVIDUAL') {
          return res.status(400).json({
            message:
              'Clinical reviewer accounts must use the individual account type',
          })
        }

        if (
          !data.phone ||
          !data.licenseNumber ||
          !data.specialization ||
          !data.institution
        ) {
          return res.status(400).json({
            message:
              'Missing required clinical reviewer information',
          })
        }

        if (file) {
          return res.status(400).json({
            message:
              'Clinical reviewer registration cannot include a donor medical report',
          })
        }
      } else if (data.accountType === 'INDIVIDUAL') {
        if (
          !data.faydaId ||
          !data.dateOfBirth ||
          !data.phone ||
          !donorAddress ||
          data.age === undefined ||
          data.weight === undefined ||
          data.height === undefined
        ) {
          return res.status(400).json({
            message: 'Missing required donor information',
          })
        }

        const faydaResult = verifyMockFayda(
          data.faydaId,
          data.name,
          data.dateOfBirth
        )

        if (!faydaResult.verified) {
          return res.status(400).json({
            message: faydaResult.message,
          })
        }

        const birthDate = new Date(data.dateOfBirth)

        if (
          birthDate > new Date() ||
          getAge(birthDate) < 18 ||
          getAge(birthDate) !== data.age
        ) {
          return res.status(400).json({
            message:
              'Age must be at least 18 and match date of birth',
          })
        }

        if (
          data.lastDonation &&
          new Date(data.lastDonation) > new Date()
        ) {
          return res.status(400).json({
            message:
              'Last donation date cannot be in the future',
          })
        }

        if (!file || !data.reportType) {
          return res.status(400).json({
            message: 'Please upload a medical report',
          })
        }

        const validFileType =
          data.reportType === 'PDF'
            ? file.mimetype === 'application/pdf'
            : [
                'image/jpeg',
                'image/png',
                'image/webp',
              ].includes(file.mimetype)

        if (!validFileType) {
          return res.status(400).json({
            message:
              'Medical report type does not match the uploaded file',
          })
        }

        const duplicateFayda =
          await prisma.donorProfile.findFirst({
            where: {
              faydaId: data.faydaId,
            },
            select: {
              id: true,
            },
          })

        if (duplicateFayda) {
          return res.status(409).json({
            message:
              'This Mock Fayda identity is already registered',
          })
        }
      } else {
        if (
          !data.hospitalName ||
          !donorAddress ||
          !data.phone
        ) {
          return res.status(400).json({
            message: 'Missing required hospital information',
          })
        }

        if (file) {
          return res.status(400).json({
            message:
              'Hospital registration cannot include a donor medical report',
          })
        }
      }

      const donorActivation = computeDonationActivation({
        dateOfBirth: data.dateOfBirth
          ? new Date(data.dateOfBirth)
          : null,
        weight: data.weight ?? 0,
        lastDonation: data.lastDonation
          ? new Date(data.lastDonation)
          : null,
        donationIntervalDays: 90,
      })

      const selectedDays =
        registrationType === 'DONOR'
          ? data.availabilities ?? []
          : []

      const days = selectedDays.map(
        (item) => item.day
      )

      if (new Set(days).size !== days.length) {
        return res.status(400).json({
          message: 'Availability days cannot repeat',
        })
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: data.email,
        },
        select: {
          id: true,
        },
      })

      if (existingUser) {
        return res.status(409).json({
          message: 'Email is already registered',
        })
      }

      const passwordHash = await bcrypt.hash(
        data.password,
        12
      )

      const role =
        registrationType === 'DOCTOR'
          ? 'DOCTOR'
          : registrationType === 'HOSPITAL'
            ? 'HOSPITAL_STAFF'
            : 'DONOR'

      const profileData =
        registrationType === 'DOCTOR'
          ? {
              doctorProfile: {
                create: {
                  licenseNumber: data.licenseNumber!,
                  specialization: data.specialization!,
                  institution: data.institution!,
                  phone: data.phone!,
                  isVerified: false,
                },
              },
            }
          : registrationType === 'HOSPITAL'
            ? {
                hospitalProfile: {
                  create: {
                    hospitalName: data.hospitalName!,
                    phone: data.phone!,
                    address: donorAddress!,
                    subcity: data.subcity || null,
                    wereda: data.wereda || null,
                    additionalPhone:
                      data.additionalPhone || null,
                    isVerified: false,
                    status: 'PENDING' as const,
                  },
                },
              }
            : {
                donorProfile: {
                  create: {
                    faydaId: data.faydaId!,
                    dateOfBirth: new Date(
                      data.dateOfBirth!
                    ),
                    phone: data.phone!,
                    additionalPhone:
                      data.additionalPhone || null,
                    address: donorAddress!,
                    subcity: data.subcity || null,
                    wereda: data.wereda || null,
                    age: data.age!,
                    weight: data.weight!,
                    height: data.height!,
                    currentAvailability:
                      data.currentAvailability ??
                      'UNAVAILABLE',
                    lastDonation: data.lastDonation
                      ? new Date(data.lastDonation)
                      : null,
                    verificationStatus: 'PENDING' as const,
                    activeStatus: donorActivation.status,
                    activationNotes:
                      activationNotes(donorActivation),
                    availabilities: {
                      create: selectedDays.map(
                        (item) => ({
                          day: item.day,
                          time: normalizeAvailability(item)
                            .time,
                        })
                      ),
                    },
                  },
                },
              }

      const user = await prisma.$transaction(
        async (tx) => {
          const created = await tx.user.create({
            data: {
              name: data.name,
              email: data.email,
              passwordHash,
              accountType: data.accountType,
              role,
              isActive: registrationType !== 'DOCTOR',
              ...profileData,
            },
            include: {
              donorProfile: true,
              hospitalProfile: true,
              doctorProfile: true,
            },
          })

          if (registrationType === 'DONOR') {
            await tx.medicalReport.create({
              data: {
                donorProfileId:
                  created.donorProfile!.id,
                uploadedByUserId: created.id,
                reportType: data.reportType!,
                fileUrl: file!.filename,
                verificationStatus: 'PENDING',
              },
            })
          } else if (registrationType === 'HOSPITAL') {
            await tx.hospitalStaffMember.create({
              data: {
                hospitalProfileId:
                  created.hospitalProfile!.id,
                userId: created.id,
                staffRole: 'OWNER',
                isActive: true,
              },
            })
          }

          return created
        }
      )

      if (registrationType !== 'DOCTOR') {
        try {
          const isDonor = registrationType === 'DONOR'

          const welcomeEmail = await queueNotification({
            userId: user.id,
            type: isDonor
              ? 'DONOR_REGISTERED'
              : 'HOSPITAL_REGISTERED',
            context: {
              recipientName: user.name,
              hospitalName: user.hospitalProfile?.hospitalName,
            },
            relatedEntityType: isDonor
              ? 'DonorProfile'
              : 'HospitalProfile',
            relatedEntityId: isDonor
              ? user.donorProfile?.id
              : user.hospitalProfile?.id,
          })

          if (
            welcomeEmail?.status === 'PENDING' &&
            process.env.NODE_ENV !== 'test'
          ) {
            // Send the welcome email immediately instead of waiting for the
            // background job; failures are retried by the job as usual.
            void deliverNotification(welcomeEmail.id).catch(
              (deliveryError) => {
                console.error(
                  '[auth] welcome email delivery failed',
                  deliveryError
                )
              }
            )
          }
        } catch (notificationError) {
          console.error(
            '[auth] welcome notification failed',
            notificationError
          )
        }
      }

      return res.status(201).json({
        message:
          registrationType === 'DONOR'
            ? 'Registration successful. Mock Fayda verification completed. Medical review pending.'
            : registrationType === 'HOSPITAL'
              ? 'Hospital registration submitted. Administrator approval pending.'
              : 'Clinical reviewer registration submitted. An administrator must activate your account before you can sign in.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountType: user.accountType,
          isActive: user.isActive,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(409).json({
          message:
            'An account with this information already exists',
        })
      }

      console.error('Registration error:', error)

      return res.status(500).json({
        message: 'Registration failed',
      })
    }
  }
)

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid login information',
      })
    }

    const { email, password, accountType } = parsed.data

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        hospitalProfile: true,
      },
    })

    if (!user || user.accountType !== accountType) {
      return res.status(401).json({
        message: 'Invalid email or password',
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

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Account is inactive',
      })
    }

    const secret = process.env.JWT_SECRET

    if (!secret) {
      return res.status(500).json({
        message:
          'Server authentication is not configured',
      })
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        accountType: user.accountType,
        passwordVersion: user.passwordVersion,
      },
      secret,
      {
        expiresIn: '1h',
        jwtid: randomUUID(),
      }
    )

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountType: user.accountType,
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    return res.status(500).json({
      message: 'Login failed',
    })
  }
})

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(
      req.body
    )

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Please enter a valid email address',
      })
    }

    try {
      const user = await prisma.user.findUnique({
        where: {
          email: parsed.data.email,
        },
        select: {
          id: true,
          email: true,
        },
      })

      if (user) {
        const token = randomBytes(32)
          .toString('hex')

        const tokenHash = hashResetToken(token)

        const expiresAt = new Date(
          Date.now() +
            RESET_EXPIRY_MINUTES * 60 * 1000
        )

        await prisma.passwordResetToken.upsert({
          where: {
            userId: user.id,
          },
          create: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
          update: {
            tokenHash,
            expiresAt,
            createdAt: new Date(),
          },
        })

        try {
          await sendPasswordResetEmailWithRetry(
            user.email,
            token
          )
        } catch (emailError) {
          console.error(
            '[auth] password reset email delivery failed',
            {
              userId: user.id,
              error:
                emailError instanceof Error
                  ? emailError.message
                  : String(emailError),
            }
          )

          await prisma.passwordResetToken.deleteMany({
            where: {
              userId: user.id,
              tokenHash,
            },
          })
        }
      }
    } catch (error) {
      console.error(
        'Forgot password error:',
        error
      )
    }

    return res.status(200).json({
      message: GENERIC_RESET_MESSAGE,
    })
  }
)

router.post(
  '/reset-password',
  resetPasswordLimiter,
  async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(
      req.body
    )

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid reset token or password',
      })
    }

    const { token, password } = parsed.data
    const tokenHash = hashResetToken(token)

    try {
      const resetRecord =
        await prisma.passwordResetToken.findUnique({
          where: {
            tokenHash,
          },
          select: {
            id: true,
            expiresAt: true,
          },
        })

      if (
        !resetRecord ||
        resetRecord.expiresAt <= new Date()
      ) {
        return res.status(400).json({
          message:
            'Password reset link is invalid or expired',
        })
      }

      const passwordHash = await bcrypt.hash(
        password,
        12
      )

      const updated = await prisma.$transaction(
        async (tx) => {
          const record =
            await tx.passwordResetToken.findUnique({
              where: {
                tokenHash,
              },
              select: {
                id: true,
                userId: true,
                expiresAt: true,
              },
            })

          if (
            !record ||
            record.expiresAt <= new Date()
          ) {
            return false
          }

          const consumed =
            await tx.passwordResetToken.deleteMany({
              where: {
                id: record.id,
                tokenHash,
                expiresAt: {
                  gt: new Date(),
                },
              },
            })

          if (consumed.count !== 1) {
            return false
          }

          await tx.user.update({
            where: {
              id: record.userId,
            },
            data: {
              passwordHash,
              passwordVersion: {
                increment: 1,
              },
            },
          })

          return true
        }
      )

      if (!updated) {
        return res.status(400).json({
          message:
            'Password reset link is invalid or expired',
        })
      }

      return res.status(200).json({
        message:
          'Password updated successfully. Please log in again.',
      })
    } catch (error) {
      console.error(
        'Reset password error:',
        error
      )

      return res.status(500).json({
        message: 'Unable to reset password',
      })
    }
  }
)

router.post(
  '/logout',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required',
        })
      }

      const { jti, exp } = req.user

      await prisma.$transaction([
        prisma.revokedToken.upsert({
          where: { jti },
          create: {
            jti,
            expiresAt: new Date(exp * 1000),
          },
          update: {},
        }),
        prisma.revokedToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }),
      ])

      return res.status(200).json({
        message: 'Logged out successfully',
      })
    } catch (error) {
      console.error('Logout error:', error)

      return res.status(500).json({
        message: 'Unable to log out',
      })
    }
  }
)

export default router