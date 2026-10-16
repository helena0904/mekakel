import type { Request, Response } from 'express'
import { z } from 'zod'
import { verifyMockFayda } from '../services/fayda.service'

const faydaVerificationSchema = z.object({
  faydaId: z
    .string()
    .trim()
    .regex(
      /^\d{16}$/,
      'Fayda ID must contain exactly 16 digits.'
    ),

  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name.'),

  dateOfBirth: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date of birth must use YYYY-MM-DD format.'
    ),
})

export function verifyFayda(
  req: Request,
  res: Response
) {
  res.setHeader('Cache-Control', 'no-store')

  const parsed = faydaVerificationSchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      simulated: true,
      message:
        parsed.error.issues[0]?.message ??
        'Invalid verification information.',
      identity: null,
    })
  }

  const {
    faydaId,
    fullName,
    dateOfBirth,
  } = parsed.data

  const result = verifyMockFayda(
    faydaId,
    fullName,
    dateOfBirth
  )

  return res.status(200).json({
    success: result.verified,
    simulated: true,
    message: result.message,
    identity: result.verified
      ? result.identity ?? null
      : null,
  })
}