import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Response } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'
import { REPORT_DIR } from '../middleware/upload.middleware'
import {
  decideDonorVerification,
  findReportForReview,
  getVerificationDetail,
  listVerificationQueue,
} from '../services/medical-verification.service'
import {
  actorFromRequest,
  recordAuditSafely,
} from '../services/audit.service'
import { reviewDonorVerificationSchema } from '../validators/donor.schema'
import { listVerificationQueueQuerySchema } from '../validators/admin.schema'

function parseId(value: unknown): number | null {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

function doctorUserIdFrom(
  req: AuthRequest,
  res: Response
): number | null {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' })
    return null
  }

  return req.user.userId
}

export async function getVerificationQueue(
  req: AuthRequest,
  res: Response
) {
  const doctorUserId = doctorUserIdFrom(req, res)

  if (doctorUserId === null) {
    return
  }

  const parsed = listVerificationQueueQuerySchema.safeParse(
    req.query
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid queue filters',
    })
  }

  try {
    const donors = await listVerificationQueue(
      doctorUserId,
      parsed.data
    )

    return res.status(200).json({ donors })
  } catch (error) {
    console.error('List verification queue error:', error)

    return res.status(500).json({
      message: 'Unable to load the verification queue',
    })
  }
}

export async function getVerification(
  req: AuthRequest,
  res: Response
) {
  const doctorUserId = doctorUserIdFrom(req, res)

  if (doctorUserId === null) {
    return
  }

  const donorProfileId = parseId(req.params.id)

  if (donorProfileId === null) {
    return res.status(400).json({
      message: 'Invalid donor id',
    })
  }

  try {
    const detail = await getVerificationDetail(
      doctorUserId,
      donorProfileId
    )

    if (!detail) {
      return res.status(404).json({
        message: 'Donor not found',
      })
    }

    return res.status(200).json(detail)
  } catch (error) {
    console.error('Get verification detail error:', error)

    return res.status(500).json({
      message: 'Unable to load the donor verification',
    })
  }
}

export async function postVerificationDecision(
  req: AuthRequest,
  res: Response
) {
  const doctorUserId = doctorUserIdFrom(req, res)

  if (doctorUserId === null) {
    return
  }

  const donorProfileId = parseId(req.params.id)

  if (donorProfileId === null) {
    return res.status(400).json({
      message: 'Invalid donor id',
    })
  }

  const parsed = reviewDonorVerificationSchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid review information',
    })
  }

  try {
    const donor = await decideDonorVerification(
      donorProfileId,
      parsed.data,
      actorFromRequest(req),
      doctorUserId
    )

    if (!donor) {
      return res.status(404).json({
        message: 'Donor not found',
      })
    }

    return res.status(200).json({
      message: 'Donor verification updated',
      donor,
    })
  } catch (error) {
    console.error('Doctor verification decision error:', error)

    return res.status(500).json({
      message: 'Unable to update donor verification',
    })
  }
}

export async function getReportFile(
  req: AuthRequest,
  res: Response
) {
  const doctorUserId = doctorUserIdFrom(req, res)

  if (doctorUserId === null) {
    return
  }

  const reportId = parseId(req.params.id)

  if (reportId === null) {
    return res.status(400).json({
      message: 'Invalid report id',
    })
  }

  try {
    const report = await findReportForReview(
      reportId,
      doctorUserId
    )

    if (!report) {
      return res.status(404).json({
        message: 'Report not found',
      })
    }

    const filePath = path.join(
      REPORT_DIR,
      path.basename(report.fileUrl)
    )

    if (!existsSync(filePath)) {
      return res.status(404).json({
        message: 'Report file is no longer available',
      })
    }

    void recordAuditSafely({
      ...actorFromRequest(req),
      action: 'MEDICAL_REPORT_ACCESSED',
      entityType: 'MedicalReport',
      entityId: report.id,
      summary: `Medical report ${report.id} opened for review`,
    })

    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(filePath)}"`
    )

    return res.sendFile(filePath)
  } catch (error) {
    console.error('Open medical report error:', error)

    return res.status(500).json({
      message: 'Unable to open the medical report',
    })
  }
}
