import type { Response } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'
import { resolveHospitalAccess } from '../services/hospital.service'
import { matchRequestById } from '../services/matching.service'

function parseId(value: unknown): number | null {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export async function getRequestMatches(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required',
    })
  }

  const access = await resolveHospitalAccess(req.user.userId)

  if (!access) {
    return res.status(403).json({
      message: 'Hospital access required',
    })
  }

  const requestId = parseId(req.params.id)

  if (requestId === null) {
    return res.status(400).json({
      message: 'Invalid blood request id',
    })
  }

  try {
    const matches = await matchRequestById(
      access.hospitalProfileId,
      requestId
    )

    if (!matches) {
      return res.status(404).json({
        message: 'Blood request not found',
      })
    }

    return res.status(200).json({ matches })
  } catch (error) {
    console.error('Match blood request error:', error)

    return res.status(500).json({
      message: 'Unable to compute matching sources',
    })
  }
}
