import bcrypt from 'bcrypt'

import prisma from '../lib/prisma'
import type {
  CreateStaffInput,
  ReviewHospitalInput,
  UpdateHospitalProfileInput,
  UpdateStaffInput,
} from '../validators/hospital.schema'

export type HospitalStaffRoleValue =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'TECHNICIAN'
  | 'VIEWER'

export interface HospitalAccess {
  hospitalProfileId: number
  role: HospitalStaffRoleValue
  userRole: string
}

const staffUserSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
} as const

/**
 * Resolves which hospital a user may act for. Hospital owners act through
 * their own HospitalProfile; additional staff act through an active
 * HospitalStaffMember membership. Anything else is denied.
 */
export async function resolveHospitalAccess(
  userId: number
): Promise<HospitalAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountType: true,
      role: true,
      hospitalProfile: { select: { id: true } },
      hospitalStaffMember: {
        select: {
          hospitalProfileId: true,
          staffRole: true,
          isActive: true,
        },
      },
    },
  })

  if (!user || user.accountType !== 'HOSPITAL') {
    return null
  }

  if (user.hospitalProfile) {
    return {
      hospitalProfileId: user.hospitalProfile.id,
      role: 'OWNER',
      userRole: user.role,
    }
  }

  const member = user.hospitalStaffMember

  if (member && member.isActive) {
    return {
      hospitalProfileId: member.hospitalProfileId,
      role: member.staffRole,
      userRole: user.role,
    }
  }

  return null
}

export function getHospitalById(hospitalProfileId: number) {
  return prisma.hospitalProfile.findUnique({
    where: { id: hospitalProfileId },
    include: {
      user: { select: staffUserSelect },
    },
  })
}

export function updateHospitalProfile(
  hospitalProfileId: number,
  data: UpdateHospitalProfileInput
) {
  return prisma.hospitalProfile.update({
    where: { id: hospitalProfileId },
    data: {
      hospitalName: data.hospitalName,
      address: data.address,
      phone: data.phone,
      additionalPhone: data.additionalPhone || null,
    },
    include: {
      user: { select: staffUserSelect },
    },
  })
}

export function listStaff(hospitalProfileId: number) {
  return prisma.hospitalStaffMember.findMany({
    where: { hospitalProfileId },
    orderBy: [{ id: 'asc' }],
    include: {
      user: { select: staffUserSelect },
    },
  })
}

export function findStaffMember(
  hospitalProfileId: number,
  staffId: number
) {
  return prisma.hospitalStaffMember.findFirst({
    where: { id: staffId, hospitalProfileId },
    include: {
      user: { select: staffUserSelect },
    },
  })
}

export async function createStaff(
  hospitalProfileId: number,
  data: CreateStaffInput
) {
  const passwordHash = await bcrypt.hash(data.password, 12)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        accountType: 'HOSPITAL',
        role: 'HOSPITAL_STAFF',
        isActive: true,
      },
    })

    return tx.hospitalStaffMember.create({
      data: {
        hospitalProfileId,
        userId: user.id,
        staffRole: data.staffRole,
        isActive: true,
      },
      include: {
        user: { select: staffUserSelect },
      },
    })
  })
}

export function updateStaff(
  staffId: number,
  data: UpdateStaffInput
) {
  return prisma.hospitalStaffMember.update({
    where: { id: staffId },
    data: {
      staffRole: data.staffRole,
      isActive: data.isActive,
    },
    include: {
      user: { select: staffUserSelect },
    },
  })
}

export function deleteStaff(staffId: number) {
  return prisma.hospitalStaffMember.delete({
    where: { id: staffId },
  })
}

export function listHospitals() {
  return prisma.hospitalProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: staffUserSelect },
      _count: {
        select: { staff: true, bloodUnits: true },
      },
    },
  })
}

interface ReviewTarget {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  isVerified: boolean
  isActive: boolean
}

function reviewTarget(
  decision: ReviewHospitalInput['decision']
): ReviewTarget {
  switch (decision) {
    case 'APPROVE':
    case 'ACTIVATE':
      return {
        status: 'APPROVED',
        isVerified: true,
        isActive: true,
      }
    case 'SUSPEND':
      return {
        status: 'SUSPENDED',
        isVerified: false,
        isActive: false,
      }
    default:
      return {
        status: 'REJECTED',
        isVerified: false,
        isActive: false,
      }
  }
}

export async function reviewHospital(
  hospitalProfileId: number,
  data: ReviewHospitalInput,
  adminUserId: number
) {
  const hospital = await prisma.hospitalProfile.findUnique({
    where: { id: hospitalProfileId },
    select: { id: true, userId: true },
  })

  if (!hospital) {
    return null
  }

  const target = reviewTarget(data.decision)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.hospitalProfile.update({
      where: { id: hospitalProfileId },
      data: {
        status: target.status,
        isVerified: target.isVerified,
        reviewNotes: data.notes || null,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
      },
      include: {
        user: { select: staffUserSelect },
      },
    })

    await tx.user.update({
      where: { id: hospital.userId },
      data: { isActive: target.isActive },
    })

    return updated
  })
}
