import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Response } from 'express'
import { Prisma } from '@prisma/client'

import type { AuthRequest } from '../middleware/auth.middleware'
import { REPORT_DIR } from '../middleware/upload.middleware'
import {
  createStaff,
  deleteStaff,
  findStaffMember,
  getHospitalById,
  isHospitalApproved,
  listHospitals,
  listStaff,
  notifyHospitalReview,
  resolveHospitalAccess,
  reviewHospital,
  updateHospitalProfile,
  updateStaff,
} from '../services/hospital.service'
import type {
  HospitalAccess,
  HospitalStaffRoleValue,
} from '../services/hospital.service'
import {
  findDonorReportForHospital,
  getNearbyDonorDetail,
  requestDonorBlood,
  searchNearbyHospitalsAndDonors,
} from '../services/hospital-search.service'
import {
  createStaffSchema,
  hospitalSearchQuerySchema,
  reviewHospitalSchema,
  updateHospitalProfileSchema,
  updateStaffSchema,
} from '../validators/hospital.schema'
import {
  actorFromRequest,
  recordAuditSafely,
} from '../services/audit.service'

const CAN_MANAGE: HospitalStaffRoleValue[] = [
  'OWNER',
  'ADMIN',
]

const CAN_REQUEST_BLOOD: HospitalStaffRoleValue[] = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'TECHNICIAN',
]

async function ensureHospital(
  req: AuthRequest,
  res: Response
): Promise<HospitalAccess | null> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' })
    return null
  }

  const access = await resolveHospitalAccess(req.user.userId)

  if (!access) {
    res.status(403).json({ message: 'Hospital access required' })
    return null
  }

  return access
}

function ensureManage(
  req: AuthRequest,
  res: Response,
  access: HospitalAccess
): boolean {
  if (!CAN_MANAGE.includes(access.role)) {
    res.status(403).json({
      message:
        'Only hospital owners and administrators can perform this action',
    })
    return false
  }

  return true
}

function ensureAdmin(req: AuthRequest, res: Response): boolean {
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

export async function getDashboard(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  try {
    const hospital = await getHospitalById(
      access.hospitalProfileId
    )

    if (!hospital) {
      return res.status(404).json({
        message: 'Hospital profile not found',
      })
    }

    return res.status(200).json({
      hospital,
      role: access.role,
    })
  } catch (error) {
    console.error('Get hospital dashboard error:', error)

    return res.status(500).json({
      message: 'Unable to load hospital dashboard',
    })
  }
}

export async function getProfile(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  try {
    const hospital = await getHospitalById(
      access.hospitalProfileId
    )

    if (!hospital) {
      return res.status(404).json({
        message: 'Hospital profile not found',
      })
    }

    return res.status(200).json({
      profile: hospital,
      role: access.role,
    })
  } catch (error) {
    console.error('Get hospital profile error:', error)

    return res.status(500).json({
      message: 'Unable to load hospital profile',
    })
  }
}

export async function putProfile(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureManage(req, res, access)) {
    return
  }

  const parsed = updateHospitalProfileSchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid hospital information',
      errors: parsed.error.issues,
    })
  }

  try {
    const profile = await updateHospitalProfile(
      access.hospitalProfileId,
      parsed.data
    )

    return res.status(200).json({
      message: 'Hospital profile updated',
      profile,
    })
  } catch (error) {
    console.error('Update hospital profile error:', error)

    return res.status(500).json({
      message: 'Unable to update hospital profile',
    })
  }
}

export async function searchNearby(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const parsed = hospitalSearchQuerySchema.safeParse(
    req.query
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid search filters',
    })
  }

  try {
    const result = await searchNearbyHospitalsAndDonors(
      access.hospitalProfileId,
      parsed.data
    )

    if (!result) {
      return res.status(404).json({
        message: 'Hospital profile not found',
      })
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Hospital nearby search error:', error)

    return res.status(500).json({
      message: 'Unable to search nearby donors and hospitals',
    })
  }
}

export async function getDonorDetail(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const donorProfileId = Number(req.params.id)

  if (!Number.isInteger(donorProfileId) || donorProfileId <= 0) {
    return res.status(400).json({
      message: 'Invalid donor id',
    })
  }

  try {
    const donor = await getNearbyDonorDetail(donorProfileId)

    if (!donor) {
      return res.status(404).json({
        message: 'Donor not found',
      })
    }

    return res.status(200).json({ donor })
  } catch (error) {
    console.error('Get nearby donor detail error:', error)

    return res.status(500).json({
      message: 'Unable to load donor details',
    })
  }
}

export async function postDonorBloodRequest(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!isHospitalApproved(access)) {
    return res.status(403).json({
      message:
        'Hospital approval is required before requesting donors',
    })
  }

  if (!CAN_REQUEST_BLOOD.includes(access.role)) {
    return res.status(403).json({
      message:
        'Your hospital role does not allow requesting donors',
    })
  }

  const donorProfileId = Number(req.params.id)

  if (!Number.isInteger(donorProfileId) || donorProfileId <= 0) {
    return res.status(400).json({
      message: 'Invalid donor id',
    })
  }

  try {
    const result = await requestDonorBlood(
      access.hospitalProfileId,
      donorProfileId
    )

    if (!result) {
      return res.status(404).json({
        message: 'Donor not found',
      })
    }

    void recordAuditSafely({
      ...actorFromRequest(req),
      action: 'DONOR_BLOOD_REQUESTED',
      entityType: 'DonorProfile',
      entityId: result.donorProfileId,
      summary: `Urgent blood request sent to ${result.donorName}`,
    })

    return res.status(201).json({
      message: 'Donor notified that blood is needed',
      request: result,
    })
  } catch (error) {
    console.error('Request donor blood error:', error)

    return res.status(500).json({
      message: 'Unable to notify the donor',
    })
  }
}

export async function getDonorReportFile(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const reportId = Number(req.params.id)

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({
      message: 'Invalid report id',
    })
  }

  try {
    const report = await findDonorReportForHospital(reportId)

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
      summary: `Medical report ${report.id} opened from hospital search`,
    })

    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(filePath)}"`
    )

    return res.sendFile(filePath)
  } catch (error) {
    console.error('Open hospital donor report error:', error)

    return res.status(500).json({
      message: 'Unable to open the medical report',
    })
  }
}

export async function getStaff(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureManage(req, res, access)) {
    return
  }

  try {
    const staff = await listStaff(access.hospitalProfileId)

    return res.status(200).json({ staff })
  } catch (error) {
    console.error('List hospital staff error:', error)

    return res.status(500).json({
      message: 'Unable to load hospital staff',
    })
  }
}

export async function postStaff(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureManage(req, res, access)) {
    return
  }

  const parsed = createStaffSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid staff information',
      errors: parsed.error.issues,
    })
  }

  try {
    const member = await createStaff(
      access.hospitalProfileId,
      parsed.data
    )

    return res.status(201).json({
      message: 'Staff member added',
      staff: member,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return res.status(409).json({
        message:
          'An account with this email already exists',
      })
    }

    console.error('Create hospital staff error:', error)

    return res.status(500).json({
      message: 'Unable to add staff member',
    })
  }
}

export async function patchStaff(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureManage(req, res, access)) {
    return
  }

  const staffId = Number(req.params.id)

  if (!Number.isInteger(staffId) || staffId <= 0) {
    return res.status(400).json({
      message: 'Invalid staff id',
    })
  }

  const parsed = updateStaffSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid staff update',
    })
  }

  try {
    const existing = await findStaffMember(
      access.hospitalProfileId,
      staffId
    )

    if (!existing) {
      return res.status(404).json({
        message: 'Staff member not found',
      })
    }

    if (existing.staffRole === 'OWNER') {
      return res.status(403).json({
        message:
          'The hospital owner account cannot be modified',
      })
    }

    if (
      existing.userId === req.user?.userId &&
      parsed.data.isActive === false
    ) {
      return res.status(403).json({
        message: 'You cannot deactivate your own account',
      })
    }

    const staff = await updateStaff(staffId, parsed.data)

    return res.status(200).json({
      message: 'Staff member updated',
      staff,
    })
  } catch (error) {
    console.error('Update hospital staff error:', error)

    return res.status(500).json({
      message: 'Unable to update staff member',
    })
  }
}

export async function removeStaff(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureManage(req, res, access)) {
    return
  }

  const staffId = Number(req.params.id)

  if (!Number.isInteger(staffId) || staffId <= 0) {
    return res.status(400).json({
      message: 'Invalid staff id',
    })
  }

  try {
    const existing = await findStaffMember(
      access.hospitalProfileId,
      staffId
    )

    if (!existing) {
      return res.status(404).json({
        message: 'Staff member not found',
      })
    }

    if (existing.staffRole === 'OWNER') {
      return res.status(403).json({
        message:
          'The hospital owner account cannot be removed',
      })
    }

    if (existing.userId === req.user?.userId) {
      return res.status(403).json({
        message: 'You cannot remove your own account',
      })
    }

    await deleteStaff(staffId)

    return res.status(200).json({
      message: 'Staff member removed',
    })
  } catch (error) {
    console.error('Remove hospital staff error:', error)

    return res.status(500).json({
      message: 'Unable to remove staff member',
    })
  }
}

export async function getHospitalRegistrations(
  req: AuthRequest,
  res: Response
) {
  if (!ensureAdmin(req, res)) {
    return
  }

  try {
    const hospitals = await listHospitals()

    return res.status(200).json({ hospitals })
  } catch (error) {
    console.error('List hospital registrations error:', error)

    return res.status(500).json({
      message: 'Unable to load hospital registrations',
    })
  }
}

export async function reviewHospitalRegistration(
  req: AuthRequest,
  res: Response
) {
  if (!ensureAdmin(req, res)) {
    return
  }

  const hospitalId = Number(req.params.id)

  if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({
      message: 'Invalid hospital id',
    })
  }

  const parsed = reviewHospitalSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid review information',
    })
  }

  if (
    (parsed.data.decision === 'REJECT' ||
      parsed.data.decision === 'SUSPEND') &&
    !parsed.data.notes
  ) {
    return res.status(400).json({
      message:
        'A reason is required to reject or suspend a hospital',
    })
  }

  try {
    const hospital = await reviewHospital(
      hospitalId,
      parsed.data,
      actorFromRequest(req)
    )

    if (!hospital) {
      return res.status(404).json({
        message: 'Hospital not found',
      })
    }

    try {
      await notifyHospitalReview(
        hospital,
        parsed.data.decision,
        parsed.data.notes
      )
    } catch (notificationError) {
      console.error(
        '[hospital] review notification failed',
        notificationError
      )
    }

    return res.status(200).json({
      message: 'Hospital registration updated',
      hospital,
    })
  } catch (error) {
    console.error('Review hospital registration error:', error)

    return res.status(500).json({
      message: 'Unable to update hospital registration',
    })
  }
}
