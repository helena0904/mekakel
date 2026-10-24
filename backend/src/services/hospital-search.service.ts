import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import {
  isCompatible,
  explainCompatibility,
} from './compatibility.service'
import type { CompatibilityExplanation } from './compatibility.service'
import { computeEligibility } from './eligibility.service'
import {
  getCompatibilityConfig,
  getEligibilityConfig,
} from './settings.service'
import { isAvailableStock } from './inventory.service'
import { notifyUser } from './notification.service'
import type { HospitalSearchQuery } from '../validators/hospital.schema'

export interface NearbyHospitalUnitSummary {
  bloodType: string
  component: string
  availableUnits: number
}

export interface NearbyHospitalUnitDetail {
  id: number
  bagId: string
  bloodType: string
  component: string
  collectionDate: Date
  expiryDate: Date
  storageLocation: string | null
}

export interface NearbyHospital {
  id: number
  hospitalName: string
  address: string
  subcity: string | null
  wereda: string | null
  phone: string
  additionalPhone: string | null
  availableUnits: number
  unitSummary: NearbyHospitalUnitSummary[]
  unitDetails: NearbyHospitalUnitDetail[]
}

export interface NearbyDonor {
  donorProfileId: number
  displayName: string
  bloodType: string | null
  activeStatus: string
  subcity: string | null
  wereda: string | null
  address: string | null
  contactAllowed: boolean
  contactPhone: string | null
  lastDonation: Date | null
  nextEligibleDate: string | null
  compatibility: CompatibilityExplanation | null
}

export interface HospitalDonorReport {
  id: number
  reportType: string
  verificationStatus: string
  createdAt: Date
  verifiedAt: Date | null
  rejectionReason: string | null
}

export interface HospitalDonorDonation {
  id: number
  donatedAt: Date
  facilityName: string | null
  units: number | null
  notes: string | null
}

export interface HospitalDonorDetail {
  donorProfileId: number
  displayName: string
  email: string | null
  bloodType: string | null
  dateOfBirth: Date | null
  age: number
  weight: number
  height: number
  subcity: string | null
  wereda: string | null
  address: string | null
  phone: string | null
  additionalPhone: string | null
  contactAllowed: boolean
  currentAvailability: string
  activeStatus: string
  verificationStatus: string
  verifiedAt: Date | null
  lastDonation: Date | null
  nextEligibleDate: string | null
  donationIntervalDays: number
  medicalReports: HospitalDonorReport[]
  reportsRestricted: boolean
  donationHistory: HospitalDonorDonation[]
  availabilities: Array<{ day: string; time: string }>
}

export interface HospitalSearchResult {
  location: {
    subcity: string | null
    wereda: string | null
  }
  bloodType: string | null
  component: string
  hospitals: NearbyHospital[]
  donors: NearbyDonor[]
  generatedAt: Date
}

export async function searchNearbyHospitalsAndDonors(
  hospitalProfileId: number,
  filters: HospitalSearchQuery
): Promise<HospitalSearchResult | null> {
  const ownHospital = await prisma.hospitalProfile.findUnique({
    where: { id: hospitalProfileId },
    select: { subcity: true, wereda: true },
  })

  if (!ownHospital) {
    return null
  }

  const subcity = filters.subcity ?? ownHospital.subcity
  const wereda = filters.wereda ?? ownHospital.wereda
  const component = filters.component ?? 'RED_CELLS'
  const requestedBloodType = filters.bloodType ?? null

  const now = new Date()

  const [compatibilityConfig, eligibilityConfig] = await Promise.all([
    getCompatibilityConfig(),
    getEligibilityConfig(),
  ])

  const hospitalOr: Prisma.HospitalProfileWhereInput[] = []

  if (subcity) {
    hospitalOr.push(
      { subcity: { equals: subcity, mode: 'insensitive' } },
      { address: { contains: subcity, mode: 'insensitive' } }
    )
  }

  if (wereda) {
    hospitalOr.push(
      { wereda: { equals: wereda, mode: 'insensitive' } },
      { address: { contains: wereda, mode: 'insensitive' } }
    )
  }

  if (filters.q) {
    hospitalOr.push({
      hospitalName: { contains: filters.q, mode: 'insensitive' },
    })
  }

  const hospitalRows = await prisma.hospitalProfile.findMany({
    where: {
      id: { not: hospitalProfileId },
      status: { notIn: ['REJECTED', 'SUSPENDED'] },
      ...(hospitalOr.length > 0 ? { OR: hospitalOr } : {}),
    },
    select: {
      id: true,
      hospitalName: true,
      address: true,
      subcity: true,
      wereda: true,
      phone: true,
      additionalPhone: true,
      bloodUnits: {
        where: {
          status: 'AVAILABLE',
          screeningStatus: 'PASSED',
          confirmationStatus: 'CONFIRMED',
          bloodTypeConfirmed: true,
          expiryDate: { gte: now },
        },
        select: {
          id: true,
          bagId: true,
          bloodType: true,
          component: true,
          status: true,
          screeningStatus: true,
          confirmationStatus: true,
          bloodTypeConfirmed: true,
          collectionDate: true,
          expiryDate: true,
          storageLocation: true,
        },
      },
    },
    orderBy: { hospitalName: 'asc' },
  })

  const hospitals: NearbyHospital[] = hospitalRows.map((hospital) => {
    const validUnits = hospital.bloodUnits.filter((unit) =>
      isAvailableStock({ ...unit, status: 'AVAILABLE' }, now)
    )

    const compatibleUnits = requestedBloodType
      ? validUnits.filter((unit) =>
          isCompatible(
            unit.bloodType,
            requestedBloodType,
            component,
            compatibilityConfig
          )
        )
      : validUnits

    const grouped = new Map<string, NearbyHospitalUnitSummary>()

    for (const unit of compatibleUnits) {
      const key = `${unit.bloodType}:${unit.component}`
      const existing = grouped.get(key)

      if (existing) {
        existing.availableUnits += 1
      } else {
        grouped.set(key, {
          bloodType: unit.bloodType,
          component: unit.component,
          availableUnits: 1,
        })
      }
    }

    return {
      id: hospital.id,
      hospitalName: hospital.hospitalName,
      address: hospital.address,
      subcity: hospital.subcity,
      wereda: hospital.wereda,
      phone: hospital.phone,
      additionalPhone: hospital.additionalPhone,
      availableUnits: compatibleUnits.length,
      unitSummary: [...grouped.values()].sort((a, b) =>
        a.bloodType.localeCompare(b.bloodType)
      ),
      unitDetails: [...compatibleUnits]
        .sort(
          (a, b) =>
            a.expiryDate.getTime() - b.expiryDate.getTime()
        )
        .map((unit) => ({
          id: unit.id,
          bagId: unit.bagId,
          bloodType: unit.bloodType,
          component: unit.component,
          collectionDate: unit.collectionDate,
          expiryDate: unit.expiryDate,
          storageLocation: unit.storageLocation,
        })),
    }
  })

  const donorOr: Prisma.DonorProfileWhereInput[] = []

  if (subcity) {
    donorOr.push(
      { subcity: { equals: subcity, mode: 'insensitive' } },
      { address: { contains: subcity, mode: 'insensitive' } }
    )
  }

  if (wereda) {
    donorOr.push(
      { wereda: { equals: wereda, mode: 'insensitive' } },
      { address: { contains: wereda, mode: 'insensitive' } }
    )
  }

  if (filters.q) {
    donorOr.push({
      user: { name: { contains: filters.q, mode: 'insensitive' } },
    })
  }

  const donorRows = await prisma.donorProfile.findMany({
    where: {
      matchingOptOut: false,
      user: { isActive: true },
      reservations: {
        none: { status: { in: ['ACTIVE', 'CONFIRMED'] } },
      },
      ...(donorOr.length > 0 ? { OR: donorOr } : {}),
    },
    select: {
      id: true,
      bloodType: true,
      subcity: true,
      wereda: true,
      address: true,
      phone: true,
      shareLocation: true,
      consentToContact: true,
      lastDonation: true,
      dateOfBirth: true,
      weight: true,
      verificationStatus: true,
      currentAvailability: true,
      donationIntervalDays: true,
      activeStatus: true,
      user: { select: { name: true } },
      donationHistory: { select: { donatedAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  const donors: NearbyDonor[] = donorRows
    .filter((donor) => {
      if (!requestedBloodType) {
        return true
      }

      if (!donor.bloodType) {
        return false
      }

      return isCompatible(
        donor.bloodType,
        requestedBloodType,
        component,
        compatibilityConfig
      )
    })
    .map((donor) => {
      const eligibility = computeEligibility(
        donor,
        donor.donationHistory.map((record) => record.donatedAt),
        now,
        eligibilityConfig
      )

      return {
        donorProfileId: donor.id,
        displayName: donor.user.name,
        bloodType: donor.bloodType,
        activeStatus: donor.activeStatus,
        subcity: donor.subcity,
        wereda: donor.wereda,
        address: donor.shareLocation ? donor.address : null,
        contactAllowed: donor.consentToContact,
        contactPhone: donor.consentToContact ? donor.phone : null,
        lastDonation: donor.lastDonation,
        nextEligibleDate: eligibility.nextEligibleDate,
        compatibility:
          requestedBloodType && donor.bloodType
            ? explainCompatibility(
                donor.bloodType,
                requestedBloodType,
                component,
                compatibilityConfig
              )
            : null,
      }
    })

  return {
    location: {
      subcity: subcity ?? null,
      wereda: wereda ?? null,
    },
    bloodType: requestedBloodType,
    component,
    hospitals,
    donors,
    generatedAt: now,
  }
}

/**
 * Returns the clinical and contact information a hospital needs to evaluate
 * a donor found through nearby search. The Fayda ID is intentionally never
 * selected so it cannot leak through this endpoint.
 */
export async function hasAcceptedDonorReservation(
  hospitalProfileId: number,
  donorProfileId: number,
  now: Date = new Date()
): Promise<boolean> {
  const count = await prisma.reservation.count({
    where: {
      hospitalProfileId,
      donorProfileId,
      status: 'CONFIRMED',
      donorResponse: 'ACCEPTED',
      expiresAt: { gt: now },
    },
  })

  return count > 0
}

export async function getNearbyDonorDetail(
  donorProfileId: number,
  hospitalProfileId: number,
  canViewReports = true,
  now: Date = new Date()
): Promise<HospitalDonorDetail | null> {
  const donor = await prisma.donorProfile.findFirst({
    where: {
      id: donorProfileId,
      matchingOptOut: false,
      user: { isActive: true },
    },
    select: {
      id: true,
      bloodType: true,
      dateOfBirth: true,
      age: true,
      weight: true,
      height: true,
      subcity: true,
      wereda: true,
      address: true,
      phone: true,
      additionalPhone: true,
      shareLocation: true,
      consentToContact: true,
      currentAvailability: true,
      activeStatus: true,
      verificationStatus: true,
      verifiedAt: true,
      lastDonation: true,
      donationIntervalDays: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      medicalReports: {
        select: {
          id: true,
          reportType: true,
          verificationStatus: true,
          createdAt: true,
          verifiedAt: true,
          rejectionReason: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      donationHistory: {
        select: {
          id: true,
          donatedAt: true,
          facilityName: true,
          units: true,
          notes: true,
        },
        orderBy: { donatedAt: 'desc' },
      },
      availabilities: {
        select: {
          day: true,
          time: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!donor) {
    return null
  }

  const eligibilityConfig = await getEligibilityConfig()

  const eligibility = computeEligibility(
    donor,
    donor.donationHistory.map((record) => record.donatedAt),
    now,
    eligibilityConfig
  )

  const reportsRestricted =
    !canViewReports ||
    !(await hasAcceptedDonorReservation(
      hospitalProfileId,
      donorProfileId,
      now
    ))

  return {
    donorProfileId: donor.id,
    displayName: donor.user.name,
    email: donor.consentToContact ? donor.user.email : null,
    bloodType: donor.bloodType,
    dateOfBirth: donor.dateOfBirth,
    age: donor.age,
    weight: donor.weight,
    height: donor.height,
    subcity: donor.subcity,
    wereda: donor.wereda,
    address: donor.shareLocation ? donor.address : null,
    phone: donor.consentToContact ? donor.phone : null,
    additionalPhone: donor.consentToContact
      ? donor.additionalPhone
      : null,
    contactAllowed: donor.consentToContact,
    currentAvailability: donor.currentAvailability,
    activeStatus: donor.activeStatus,
    verificationStatus: donor.verificationStatus,
    verifiedAt: donor.verifiedAt,
    lastDonation: donor.lastDonation,
    nextEligibleDate: eligibility.nextEligibleDate,
    donationIntervalDays: donor.donationIntervalDays,
    medicalReports: reportsRestricted ? [] : donor.medicalReports,
    reportsRestricted,
    donationHistory: donor.donationHistory,
    availabilities: donor.availabilities,
  }
}

export interface DonorBloodRequestResult {
  donorProfileId: number
  donorName: string
  notificationId: number | null
}

/**
 * Sends the donor a single urgent notification that the hospital needs blood.
 * This is intentionally a one-click action: hospitals do not have to fill in
 * a request form, and can follow up by phone using the contact details shown
 * in the donor search result.
 */
export async function requestDonorBlood(
  hospitalProfileId: number,
  donorProfileId: number
): Promise<DonorBloodRequestResult | null> {
  const [hospital, donor] = await Promise.all([
    prisma.hospitalProfile.findUnique({
      where: { id: hospitalProfileId },
      select: {
        hospitalName: true,
        phone: true,
        address: true,
      },
    }),
    prisma.donorProfile.findFirst({
      where: {
        id: donorProfileId,
        matchingOptOut: false,
        user: { isActive: true },
      },
      select: {
        id: true,
        bloodType: true,
        userId: true,
        user: { select: { name: true } },
      },
    }),
  ])

  if (!hospital || !donor) {
    return null
  }

  const notification = await notifyUser(
    donor.userId,
    'DONOR_BLOOD_REQUESTED',
    {
      recipientName: donor.user.name,
      hospitalName: hospital.hospitalName,
      hospitalPhone: hospital.phone,
      hospitalAddress: hospital.address,
      bloodType: donor.bloodType ?? undefined,
    },
    {
      relatedEntityType: 'HospitalProfile',
      relatedEntityId: hospitalProfileId,
    }
  )

  return {
    donorProfileId: donor.id,
    donorName: donor.user.name,
    notificationId: notification?.id ?? null,
  }
}

export async function findDonorReportForHospital(
  reportId: number,
  hospitalProfileId: number,
  now: Date = new Date()
) {
  return prisma.medicalReport.findFirst({
    where: {
      id: reportId,
      donorProfile: {
        matchingOptOut: false,
        user: { isActive: true },
        reservations: {
          some: {
            hospitalProfileId,
            status: 'CONFIRMED',
            donorResponse: 'ACCEPTED',
            expiresAt: { gt: now },
          },
        },
      },
    },
    select: {
      id: true,
      fileUrl: true,
      reportType: true,
      donorProfileId: true,
    },
  })
}
