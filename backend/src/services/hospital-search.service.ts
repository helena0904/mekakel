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
import type { HospitalSearchQuery } from '../validators/hospital.schema'

export interface NearbyHospitalUnitSummary {
  bloodType: string
  component: string
  availableUnits: number
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
          expiryDate: { gte: now },
        },
        select: {
          bloodType: true,
          component: true,
          status: true,
          screeningStatus: true,
          confirmationStatus: true,
          expiryDate: true,
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
