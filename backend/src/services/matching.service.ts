import type {
  BloodComponent,
  BloodType,
  RequestUrgency,
} from '@prisma/client'

import prisma from '../lib/prisma'
import {
  compatibleDonorTypes,
  explainCompatibility,
  isCompatible,
} from './compatibility.service'
import type {
  CompatibilityExplanation,
} from './compatibility.service'
import { computeEligibility } from './eligibility.service'
import {
  getCompatibilityConfig,
  getEligibilityConfig,
} from './settings.service'
import { assignFefoRank, daysUntil } from './fefo.service'

export interface MatchRequestRecord {
  id: number
  hospitalProfileId: number
  component: BloodComponent
  bloodType: BloodType
  requiredUnits: number
  urgency: RequestUrgency
  location: string | null
}

export interface MatchedUnit {
  unitId: number
  bagId: string
  bloodType: string
  component: string
  collectionDate: Date
  expiryDate: Date
  daysUntilExpiry: number
  storageLocation: string | null
  hospitalProfileId: number
  hospitalName: string
  hospitalAddress: string
  isOwnHospital: boolean
  fefoRank: number
  compatibility: CompatibilityExplanation
}

export interface MatchedDonor {
  donorProfileId: number
  displayName: string
  bloodType: string
  availability: string
  shareLocation: boolean
  address: string | null
  contactAllowed: boolean
  contactPhone: string | null
  lastDonation: Date | null
  nextEligibleDate: string | null
  score: number
  rank: number
  reasons: string[]
  compatibility: CompatibilityExplanation
}

export interface MatchingSummary {
  compatibleUnits: number
  compatibleDonors: number
  requiredUnits: number
  shortfall: number
}

export interface MatchingResult {
  request: {
    id: number
    component: string
    bloodType: string
    requiredUnits: number
    urgency: string
    location: string | null
  }
  units: MatchedUnit[]
  donors: MatchedDonor[]
  summary: MatchingSummary
  generatedAt: Date
  disclaimer: string
}

export const MATCHING_DISCLAIMER =
  'Matching is a coordination aid, not a clinical transfusion decision. ' +
  'Authorized clinicians must perform the required testing, compatibility ' +
  'confirmation and final decision.'

function locationTokens(value: string | null | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function isLocationMatch(
  requestLocation: string | null,
  donorAddress: string
): boolean {
  const tokens = locationTokens(requestLocation)

  if (tokens.length === 0) {
    return false
  }

  const address = donorAddress.toLowerCase()

  return tokens.some((token) => address.includes(token))
}

export async function matchRequest(
  request: MatchRequestRecord
): Promise<MatchingResult> {
  const now = new Date()

  const [compatibilityConfig, eligibilityConfig] =
    await Promise.all([
      getCompatibilityConfig(),
      getEligibilityConfig(),
    ])

  const donorTypes = compatibleDonorTypes(
    request.bloodType,
    request.component,
    compatibilityConfig
  )

  const [unitRows, donorRows] = await Promise.all([
    prisma.bloodUnit.findMany({
      where: {
        component: request.component,
        bloodType: { in: donorTypes },
        status: 'AVAILABLE',
        screeningStatus: 'PASSED',
        confirmationStatus: 'CONFIRMED',
        expiryDate: { gte: now },
        hospitalProfile: {
          status: 'APPROVED',
          isVerified: true,
        },
      },
      include: {
        hospitalProfile: {
          select: {
            id: true,
            hospitalName: true,
            address: true,
          },
        },
      },
    }),

    prisma.donorProfile.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        currentAvailability: 'AVAILABLE',
        bloodType: { not: null },
        user: { isActive: true },
      },
      include: {
        user: { select: { name: true } },
        donationHistory: { select: { donatedAt: true } },
      },
    }),
  ])

  const compatibleUnits = unitRows.filter((unit) =>
    isCompatible(
      unit.bloodType,
      request.bloodType,
      request.component,
      compatibilityConfig
    )
  )

  const units: MatchedUnit[] = assignFefoRank(
    compatibleUnits
  ).map((unit) => ({
    unitId: unit.id,
    bagId: unit.bagId,
    bloodType: unit.bloodType,
    component: unit.component,
    collectionDate: unit.collectionDate,
    expiryDate: unit.expiryDate,
    daysUntilExpiry: daysUntil(unit.expiryDate, now),
    storageLocation: unit.storageLocation,
    hospitalProfileId: unit.hospitalProfile.id,
    hospitalName: unit.hospitalProfile.hospitalName,
    hospitalAddress: unit.hospitalProfile.address,
    isOwnHospital:
      unit.hospitalProfile.id ===
      request.hospitalProfileId,
    fefoRank: unit.fefoRank,
    compatibility: explainCompatibility(
      unit.bloodType,
      request.bloodType,
      request.component,
      compatibilityConfig
    ),
  }))

  const donors: MatchedDonor[] = donorRows
    .filter((donor) => {
      if (!donor.bloodType) {
        return false
      }

      if (
        !isCompatible(
          donor.bloodType,
          request.bloodType,
          request.component,
          compatibilityConfig
        )
      ) {
        return false
      }

      const eligibility = computeEligibility(
        donor,
        donor.donationHistory.map(
          (record) => record.donatedAt
        ),
        now,
        eligibilityConfig
      )

      return eligibility.eligible
    })
    .map((donor) => {
      const eligibility = computeEligibility(
        donor,
        donor.donationHistory.map(
          (record) => record.donatedAt
        ),
        now,
        eligibilityConfig
      )

      const reasons: string[] = [
        'Currently marked available',
      ]

      let score = 10

      const locationMatch = isLocationMatch(
        request.location,
        donor.address
      )

      if (locationMatch) {
        score += 40
        reasons.push('Located near the request location')
      }

      const daysSinceLastDonation = donor.lastDonation
        ? Math.floor(
            (now.getTime() -
              donor.lastDonation.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : null

      const freshness =
        daysSinceLastDonation === null
          ? 30
          : Math.min(daysSinceLastDonation, 90)

      score += Math.round((freshness / 90) * 10)

      if (
        request.urgency !== 'ROUTINE' &&
        locationMatch
      ) {
        score +=
          request.urgency === 'EMERGENCY' ? 20 : 10

        reasons.push(
          request.urgency === 'EMERGENCY'
            ? 'Priority match for an emergency request'
            : 'Prioritized for an urgent request'
        )
      }

      const contactAllowed = donor.consentToContact

      return {
        donorProfileId: donor.id,
        displayName: contactAllowed
          ? donor.user.name
          : `Verified donor #${donor.id}`,
        bloodType: donor.bloodType as string,
        availability: donor.currentAvailability,
        shareLocation: donor.shareLocation,
        address: donor.shareLocation ? donor.address : null,
        contactAllowed,
        contactPhone: contactAllowed
          ? donor.phone
          : null,
        lastDonation: donor.lastDonation,
        nextEligibleDate: eligibility.nextEligibleDate,
        score,
        rank: 0,
        reasons,
        compatibility: explainCompatibility(
          donor.bloodType as string,
          request.bloodType,
          request.component,
          compatibilityConfig
        ),
      }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.donorProfileId - b.donorProfileId
    )
    .map((donor, index) => ({
      ...donor,
      rank: index + 1,
    }))

  const compatibleUnitCount = units.length

  return {
    request: {
      id: request.id,
      component: request.component,
      bloodType: request.bloodType,
      requiredUnits: request.requiredUnits,
      urgency: request.urgency,
      location: request.location,
    },
    units,
    donors,
    summary: {
      compatibleUnits: compatibleUnitCount,
      compatibleDonors: donors.length,
      requiredUnits: request.requiredUnits,
      shortfall: Math.max(
        0,
        request.requiredUnits - compatibleUnitCount
      ),
    },
    generatedAt: now,
    disclaimer: MATCHING_DISCLAIMER,
  }
}

export async function matchRequestById(
  hospitalProfileId: number,
  requestId: number
): Promise<MatchingResult | null> {
  const request = await prisma.bloodRequest.findFirst({
    where: { id: requestId, hospitalProfileId },
    select: {
      id: true,
      hospitalProfileId: true,
      component: true,
      bloodType: true,
      requiredUnits: true,
      urgency: true,
      location: true,
    },
  })

  if (!request) {
    return null
  }

  return matchRequest(request)
}
