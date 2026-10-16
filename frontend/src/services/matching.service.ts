import apiRequest from './api'
import type { BloodType } from './donor.service'
import type { BloodComponent } from './inventory.service'
import type { RequestUrgencyValue } from './blood-request.service'

export interface CompatibilityExplanation {
  compatible: boolean
  component: string
  rule: string
  detail: string
}

export interface MatchedUnit {
  unitId: number
  bagId: string
  bloodType: BloodType
  component: BloodComponent
  collectionDate: string
  expiryDate: string
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
  bloodType: BloodType
  availability: string
  shareLocation: boolean
  address: string | null
  contactAllowed: boolean
  contactPhone: string | null
  lastDonation: string | null
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

export interface MatchingRequestSummary {
  id: number
  component: BloodComponent
  bloodType: BloodType
  requiredUnits: number
  urgency: RequestUrgencyValue
  location: string | null
}

export interface MatchingResult {
  request: MatchingRequestSummary
  units: MatchedUnit[]
  donors: MatchedDonor[]
  summary: MatchingSummary
  generatedAt: string
  disclaimer: string
}

export async function getMatches(
  requestId: number
): Promise<MatchingResult> {
  const response = await apiRequest<{
    matches: MatchingResult
  }>(`/matching/requests/${requestId}/matches`)

  return response.matches
}
