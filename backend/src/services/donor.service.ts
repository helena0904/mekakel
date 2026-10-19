import prisma from '../lib/prisma'
import type {
  CreateDonationRecordInput,
  UpdateAvailabilityInput,
  UpdateProfileInput,
} from '../validators/donor.schema'

const profileInclude = {
  availabilities: { orderBy: { id: 'asc' as const } },
  medicalReports: {
    orderBy: { createdAt: 'desc' as const },
  },
  donationHistory: {
    orderBy: { donatedAt: 'desc' as const },
  },
}

export function findDonorProfile(userId: number) {
  return prisma.donorProfile.findUnique({
    where: {
      userId,
    },
    include: profileInclude,
  })
}

export async function updateDonorProfile(
  userId: number,
  data: UpdateProfileInput
) {
  return prisma.donorProfile.update({
    where: {
      userId,
    },
    data: {
      phone: data.phone,
      additionalPhone: data.additionalPhone || null,
      address: data.address,
      bloodType:
        data.bloodType === undefined
          ? undefined
          : data.bloodType,
      dateOfBirth: data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : undefined,
      weight: data.weight,
      height: data.height,
      donationIntervalDays: data.donationIntervalDays,
      consentToContact: data.consentToContact,
      shareLocation: data.shareLocation,
      matchingOptOut: data.matchingOptOut,
    },
    include: profileInclude,
  })
}

export async function updateAvailability(
  userId: number,
  data: UpdateAvailabilityInput
) {
  const profile = await prisma.donorProfile.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  })

  if (!profile) {
    return null
  }

  return prisma.$transaction(async (tx) => {
    await tx.donorProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        currentAvailability: data.currentAvailability,
      },
    })

    await tx.donorAvailabilitySchedule.deleteMany({
      where: {
        donorProfileId: profile.id,
      },
    })

    if (data.availabilities.length > 0) {
      await tx.donorAvailabilitySchedule.createMany({
        data: data.availabilities.map((entry) => ({
          donorProfileId: profile.id,
          day: entry.day,
          time: entry.time,
        })),
      })
    }

    return tx.donorProfile.findUnique({
      where: {
        id: profile.id,
      },
      include: profileInclude,
    })
  })
}

export async function createMedicalReport(
  userId: number,
  reportType: 'IMAGE' | 'PDF',
  filename: string
) {
  const profile = await prisma.donorProfile.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  })

  if (!profile) {
    return null
  }

  return prisma.$transaction(async (tx) => {
    const report = await tx.medicalReport.create({
      data: {
        donorProfileId: profile.id,
        uploadedByUserId: userId,
        reportType,
        fileUrl: filename,
        verificationStatus: 'PENDING',
      },
    })

    // A new report always needs a fresh medical review.
    await tx.donorProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        verificationStatus: 'PENDING',
        verificationNotes: null,
        verifiedAt: null,
      },
    })

    return report
  })
}

export function findReportForUser(
  userId: number,
  reportId: number
) {
  return prisma.medicalReport.findFirst({
    where: {
      id: reportId,
      donorProfile: {
        userId,
      },
    },
    select: {
      id: true,
      fileUrl: true,
      reportType: true,
      verificationStatus: true,
    },
  })
}

export function listDonorRegistrations() {
  return prisma.donorProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
      medicalReports: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function addDonationRecord(
  userId: number,
  data: CreateDonationRecordInput
) {
  const profile = await prisma.donorProfile.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      lastDonation: true,
    },
  })

  if (!profile) {
    return null
  }

  const donatedAt = new Date(data.donatedAt)

  return prisma.$transaction(async (tx) => {
    const record = await tx.donationRecord.create({
      data: {
        donorProfileId: profile.id,
        donatedAt,
        facilityName: data.facilityName || null,
        units: data.units ?? null,
        notes: data.notes || null,
      },
    })

    if (
      !profile.lastDonation ||
      donatedAt > profile.lastDonation
    ) {
      await tx.donorProfile.update({
        where: {
          id: profile.id,
        },
        data: {
          lastDonation: donatedAt,
        },
      })
    }

    return record
  })
}
