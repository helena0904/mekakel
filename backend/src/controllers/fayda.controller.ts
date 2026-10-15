import type { Request, Response } from 'express'
import { verifyMockFayda } from '../services/fayda.service'

export function verifyFayda(req: Request, res: Response) {
  const { faydaId, fullName, dateOfBirth } = req.body

  if (
    typeof faydaId !== 'string' ||
    typeof fullName !== 'string' ||
    typeof dateOfBirth !== 'string'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Fayda ID, full name, and date of birth are required.',
    })
  }

  if (!/^\d{16}$/.test(faydaId)) {
    return res.status(400).json({
      success: false,
      message: 'Fayda ID must contain exactly 16 digits.',
    })
  }

  const result = verifyMockFayda(faydaId, fullName, dateOfBirth)

  return res.status(200).json({
    success: result.verified,
    simulated: true,
    message: result.message,
    identity: result.identity ?? null,
  })
}