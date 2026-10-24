import prisma from '../lib/prisma'
import {
  activationNotes,
  computeDonationActivation,
} from './eligibility.service'
import {
  normalizeAvailability,
  type CreateDonationRecordInput,
  type UpdateAvailabilityInput,
  type UpdateProfileInput,
} from '../validators/donor.schema'

export function composeAddress(
  wereda?: string | null,
  subcity?: string | null
): string | null {
  const parts = [wereda, subcity]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(', ') : null
}

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

export function findDonorProfileId(userId: number) {
  return prisma.donorProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
}

export async function updateDonorProfile(
  userId: number,
  data: UpdateProfileInput
) {
  const existing = await prisma.donorProfile.findUnique({
    where: {
      userId,
    },
    include: profileInclude,
  })

  if (!existing) {
    return null
  }

  // Changing the medical report or the recorded weight always invalidates the
  // previous medical review and requires a fresh verification. Contact and
  // location details (address, phone, last donation) do not.
  const weightChanged =
    data.weight !== undefined && data.weight !== existing.weight

  const subcity =
    data.subcity !== undefined ? data.subcity : existing.subcity
  const wereda =
    data.wereda !== undefined ? data.wereda : existing.wereda

  const composed = composeAddress(wereda, subcity)

  const dateOfBirth = data.dateOfBirth
    ? new Date(data.dateOfBirth)
    : existing.dateOfBirth

  const lastDonation =
    data.lastDonation !== undefined
      ? new Date(data.lastDonation)
      : existing.lastDonation

  const donationIntervalDays =
    data.donationIntervalDays ?? existing.donationIntervalDays

  const activation = computeDonationActivation(
    {
      dateOfBirth,
      weight: data.weight,
      lastDonation,
      donationIntervalDays,
    },
    existing.donationHistory.map((record) => record.donatedAt)
  )

  return prisma.donorProfile.update({
    where: {
      userId,
    },
    data: {
      phone: data.phone,
      additionalPhone: data.additionalPhone || null,
      address: composed ?? data.address,
      subcity: subcity ?? null,
      wereda: wereda ?? null,
      bloodType:
        data.bloodType === undefined
          ? undefined
          : data.bloodType,
      dateOfBirth,
      weight: data.weight,
      height: data.height,
      donationIntervalDays,
      lastDonation:
        data.lastDonation === undefined ? undefined : lastDonation,
      consentToContact: data.consentToContact,
      shareLocation: data.shareLocation,
      matchingOptOut: data.matchingOptOut,
      activeStatus: activation.status,
      activationNotes: activationNotes(activation),
      ...(weightChanged
        ? {
            verificationStatus: 'PENDING' as const,
            verificationNotes:
              'Your weight changed. Please upload an updated medical report so your eligibility can be verified again.',
            verifiedAt: null,
          }
        : {}),
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
          time: normalizeAvailability(entry).time,
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
      dateOfBirth: true,
      weight: true,
      donationIntervalDays: true,
      donationHistory: {
        select: { donatedAt: true },
      },
    },
  })

  if (!profile) {
    return null
  }

  const donatedAt = new Date(data.donatedAt)

  const latestDonation =
    !profile.lastDonation || donatedAt > profile.lastDonation
      ? donatedAt
      : profile.lastDonation

  const activation = computeDonationActivation(
    {
      dateOfBirth: profile.dateOfBirth,
      weight: profile.weight,
      lastDonation: latestDonation,
      donationIntervalDays: profile.donationIntervalDays,
    },
    [
      ...profile.donationHistory.map((record) => record.donatedAt),
      donatedAt,
    ]
  )

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

    await tx.donorProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        lastDonation: latestDonation,
        activeStatus: activation.status,
        activationNotes: activationNotes(activation),
      },
    })

    return record
  })
}
