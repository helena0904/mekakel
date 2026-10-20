import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Response } from 'express'

import { REPORT_DIR } from '../middleware/upload.middleware'
import {
  addDonationRecord,
  createMedicalReport,
  findDonorProfile,
  findReportForUser,
  updateAvailability,
  updateDonorProfile,
} from '../services/donor.service'
import {
  decideDonorVerification,
  listVerificationQueue,
} from '../services/medical-verification.service'
import {
  actorFromRequest,
  recordAuditSafely,
} from '../services/audit.service'
import {
  computeDonationActivation,
  computeEligibility,
} from '../services/eligibility.service'
import { getEligibilityConfig } from '../services/settings.service'
import type { AuthRequest } from '../middleware/auth.middleware'
import {
  createDonationRecordSchema,
  reviewDonorVerificationSchema,
  updateAvailabilitySchema,
  updateProfileSchema,
  uploadReportSchema,
} from '../validators/donor.schema'

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

function ensureAdmin(
  req: AuthRequest,
  res: Response
): boolean {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' })
    return false
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      message: 'Administrator access required',
    })
    return false
  }

  return true
}

export async function getDonorRegistrations(
  req: AuthRequest,
  res: Response
) {
  if (!ensureAdmin(req, res)) {
    return
  }

  try {
    const donors = await listVerificationQueue({ status: 'ALL' })

    return res.status(200).json({ donors })
  } catch (error) {
    console.error('List donor registrations error:', error)

    return res.status(500).json({
      message: 'Unable to load donor registrations',
    })
  }
}

export async function reviewDonorRegistration(
  req: AuthRequest,
  res: Response
) {
  if (!ensureAdmin(req, res)) {
    return
  }

  const donorProfileId = Number(req.params.id)

  if (!Number.isInteger(donorProfileId) || donorProfileId <= 0) {
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
      actorFromRequest(req)
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
    console.error('Review donor verification error:', error)

    return res.status(500).json({
      message: 'Unable to update donor verification',
    })
  }
}

function ensureDonor(
  req: AuthRequest,
  res: Response
): number | null {
  if (!req.user) {
    res.status(401).json({
      message: 'Authentication required',
    })

    return null
  }

  if (req.user.accountType !== 'INDIVIDUAL') {
    res.status(403).json({
      message: 'Donor access required',
    })

    return null
  }

  return req.user.userId
}

export async function getProfile(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  try {
    const profile = await findDonorProfile(userId)

    if (!profile) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    return res.status(200).json({
      profile,
    })
  } catch (error) {
    console.error('Get donor profile error:', error)

    return res.status(500).json({
      message: 'Unable to load donor profile',
    })
  }
}

export async function getDashboard(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  try {
    const profile = await findDonorProfile(userId)

    if (!profile) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    const eligibility = computeEligibility(
      profile,
      profile.donationHistory.map((record) => record.donatedAt),
      new Date(),
      await getEligibilityConfig()
    )

    const activation = computeDonationActivation(
      profile,
      profile.donationHistory.map((record) => record.donatedAt)
    )

    return res.status(200).json({
      profile,
      eligibility,
      activation,
      stats: {
        totalDonations: profile.donationHistory.length,
        totalReports: profile.medicalReports.length,
        lastDonation: profile.lastDonation,
        nextEligibleDate: activation.nextEligibleDate,
      },
    })
  } catch (error) {
    console.error('Get donor dashboard error:', error)

    return res.status(500).json({
      message: 'Unable to load donor dashboard',
    })
  }
}

export async function putProfile(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  const parsed = updateProfileSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid profile information',
      errors: parsed.error.issues,
    })
  }

  try {
    const existing = await findDonorProfile(userId)

    if (!existing) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    const profile = await updateDonorProfile(
      userId,
      parsed.data
    )

    const consentChanged =
      (parsed.data.consentToContact !== undefined &&
        parsed.data.consentToContact !==
          existing.consentToContact) ||
      (parsed.data.shareLocation !== undefined &&
        parsed.data.shareLocation !== existing.shareLocation) ||
      (parsed.data.matchingOptOut !== undefined &&
        parsed.data.matchingOptOut !== existing.matchingOptOut)

    if (consentChanged) {
      void recordAuditSafely({
        ...actorFromRequest(req),
        action: 'CONSENT_CHANGED',
        entityType: 'DonorProfile',
        entityId: existing.id,
        summary:
          'Donor contact, location-sharing or matching consent changed',
      })
    }

    return res.status(200).json({
      message: 'Profile updated',
      profile,
    })
  } catch (error) {
    console.error('Update donor profile error:', error)

    return res.status(500).json({
      message: 'Unable to update donor profile',
    })
  }
}

export async function putAvailability(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  const parsed = updateAvailabilitySchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid availability information',
    })
  }

  const days = parsed.data.availabilities.map(
    (entry) => entry.day
  )

  if (new Set(days).size !== days.length) {
    return res.status(400).json({
      message: 'Availability days cannot repeat',
    })
  }

  try {
    const profile = await updateAvailability(
      userId,
      parsed.data
    )

    if (!profile) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    return res.status(200).json({
      message: 'Availability updated',
      profile,
    })
  } catch (error) {
    console.error('Update availability error:', error)

    return res.status(500).json({
      message: 'Unable to update availability',
    })
  }
}

export async function getEligibility(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  try {
    const profile = await findDonorProfile(userId)

    if (!profile) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    const eligibility = computeEligibility(
      profile,
      profile.donationHistory.map((record) => record.donatedAt),
      new Date(),
      await getEligibilityConfig()
    )

    return res.status(200).json({
      eligibility,
    })
  } catch (error) {
    console.error('Get eligibility error:', error)

    return res.status(500).json({
      message: 'Unable to compute eligibility',
    })
  }
}

export async function getReports(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  try {
    const profile = await findDonorProfile(userId)

    if (!profile) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    return res.status(200).json({
      reports: profile.medicalReports,
    })
  } catch (error) {
    console.error('Get medical reports error:', error)

    return res.status(500).json({
      message: 'Unable to load medical reports',
    })
  }
}

export async function postReport(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  const file = req.file

  if (!file) {
    return res.status(400).json({
      message: 'Please select a medical report file',
    })
  }

  const parsed = uploadReportSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Please choose a valid report type',
    })
  }

  const { reportType } = parsed.data

  const typeMatches =
    reportType === 'PDF'
      ? file.mimetype === 'application/pdf'
      : IMAGE_MIME_TYPES.includes(file.mimetype)

  if (!typeMatches) {
    return res.status(400).json({
      message:
        'Medical report type does not match the uploaded file',
    })
  }

  try {
    const report = await createMedicalReport(
      userId,
      reportType,
      file.filename
    )

    if (!report) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    return res.status(201).json({
      message:
        'Medical report uploaded. Verification is pending.',
      report,
    })
  } catch (error) {
    console.error('Upload medical report error:', error)

    return res.status(500).json({
      message: 'Unable to upload medical report',
    })
  }
}

export async function getReportFile(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  const reportId = Number(req.params.id)

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({
      message: 'Invalid report id',
    })
  }

  try {
    const report = await findReportForUser(
      userId,
      reportId
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
      summary: `Donor opened medical report ${report.id}`,
    })

    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(filePath)}"`
    )

    return res.sendFile(filePath)
  } catch (error) {
    console.error('Download medical report error:', error)

    return res.status(500).json({
      message: 'Unable to open medical report',
    })
  }
}

export async function getHistory(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  try {
    const profile = await findDonorProfile(userId)

    if (!profile) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    return res.status(200).json({
      history: profile.donationHistory,
    })
  } catch (error) {
    console.error('Get donation history error:', error)

    return res.status(500).json({
      message: 'Unable to load donation history',
    })
  }
}

export async function postHistory(
  req: AuthRequest,
  res: Response
) {
  const userId = ensureDonor(req, res)

  if (userId === null) {
    return
  }

  const parsed = createDonationRecordSchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid donation record',
    })
  }

  try {
    const record = await addDonationRecord(
      userId,
      parsed.data
    )

    if (!record) {
      return res.status(404).json({
        message: 'Donor profile not found',
      })
    }

    return res.status(201).json({
      message: 'Donation recorded',
      record,
    })
  } catch (error) {
    console.error('Add donation record error:', error)

    return res.status(500).json({
      message: 'Unable to record donation',
    })
  }
}
