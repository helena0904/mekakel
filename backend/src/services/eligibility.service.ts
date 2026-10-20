/**
 * Preliminary donation eligibility.
 *
 * IMPORTANT: this is a non-clinical, rule-of-thumb screening used to guide
 * donors. It is deliberately independent from Mock Fayda identity
 * verification: a verified identity never implies medical donation
 * eligibility. Final eligibility is always decided by an authorized
 * healthcare professional after reviewing the donor's medical report.
 */

export type VerificationStatusValue =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ADDITIONAL_INFO_REQUIRED'

export type AvailabilityValue = 'AVAILABLE' | 'UNAVAILABLE'

export interface EligibilityProfileInput {
  dateOfBirth: Date | null
  weight: number
  verificationStatus: VerificationStatusValue
  currentAvailability: AvailabilityValue
  lastDonation: Date | null
  donationIntervalDays: number
}

export interface EligibilityCheck {
  key: string
  label: string
  passed: boolean
  detail: string
  /**
   * Informational checks do not affect `eligible`; they describe the donor's
   * preferences (for example availability), which stay distinct from medical
   * approval.
   */
  informational?: boolean
}

export type EligibilityStatus =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'PENDING_VERIFICATION'

export interface EligibilityResult {
  eligible: boolean
  status: EligibilityStatus
  medicallyApproved: boolean
  nextEligibleDate: string | null
  daysUntilEligible: number | null
  checks: EligibilityCheck[]
}

const MIN_AGE = 18
const MAX_AGE = 65
const MIN_WEIGHT_KG = 50
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The three criteria the platform uses to mark a donor as active:
 *   - age is at least 18
 *   - weight is at least 50 kg
 *   - at least 90 days have passed since the last donation
 *
 * When any criterion fails the donor is marked inactive; as soon as all
 * three are met again the donor is reactivated automatically.
 */
export const ACTIVATION_MIN_AGE = 18
export const ACTIVATION_MIN_WEIGHT_KG = 50
export const ACTIVATION_INTERVAL_DAYS = 90

export interface DonationActivationProfileInput {
  dateOfBirth: Date | null
  weight: number
  lastDonation: Date | null
  donationIntervalDays?: number | null
}

export interface DonationActivationResult {
  active: boolean
  status: 'ACTIVE' | 'INACTIVE'
  reasons: string[]
  nextEligibleDate: string | null
  daysUntilEligible: number | null
  checks: EligibilityCheck[]
}

export function computeDonationActivation(
  profile: DonationActivationProfileInput,
  donationDates: Date[] = [],
  now: Date = new Date()
): DonationActivationResult {
  const age = calculateAge(profile.dateOfBirth, now)
  const agePassed = age !== null && age >= ACTIVATION_MIN_AGE
  const weightPassed = profile.weight >= ACTIVATION_MIN_WEIGHT_KG

  const interval =
    profile.donationIntervalDays &&
    profile.donationIntervalDays > 0
      ? profile.donationIntervalDays
      : ACTIVATION_INTERVAL_DAYS

  const latest = latestDonationDate(
    profile.lastDonation,
    donationDates
  )

  let nextEligibleDate: string | null = null
  let daysUntilEligible: number | null = null
  let intervalPassed = true

  if (latest) {
    const nextEligible = new Date(
      latest.getTime() + interval * DAY_MS
    )

    if (nextEligible > now) {
      intervalPassed = false
      nextEligibleDate = nextEligible.toISOString().slice(0, 10)
      daysUntilEligible = Math.ceil(
        (nextEligible.getTime() - now.getTime()) / DAY_MS
      )
    }
  }

  const checks: EligibilityCheck[] = [
    {
      key: 'age',
      label: `Age at least ${ACTIVATION_MIN_AGE}`,
      passed: agePassed,
      detail:
        age === null
          ? 'Date of birth is missing.'
          : `You are ${age} years old.`,
    },
    {
      key: 'weight',
      label: `Weigh at least ${ACTIVATION_MIN_WEIGHT_KG} kg`,
      passed: weightPassed,
      detail: `Your recorded weight is ${profile.weight} kg.`,
    },
    {
      key: 'interval',
      label: `At least ${interval} days since the last donation`,
      passed: intervalPassed,
      detail: intervalPassed
        ? 'Enough time has passed since your last donation.'
        : `You can donate again on ${nextEligibleDate}.`,
    },
  ]

  const reasons = checks
    .filter((check) => !check.passed)
    .map((check) => check.detail)

  const active = agePassed && weightPassed && intervalPassed

  return {
    active,
    status: active ? 'ACTIVE' : 'INACTIVE',
    reasons,
    nextEligibleDate,
    daysUntilEligible,
    checks,
  }
}

export function activationNotes(
  result: DonationActivationResult
): string | null {
  if (result.active) {
    return null
  }

  return result.reasons.join(' ')
}

/**
 * Configurable screening thresholds. Defaults mirror national blood-service
 * guidance and can be adjusted through organization settings.
 */
export interface EligibilityConfig {
  minAge: number
  maxAge: number
  minWeightKg: number
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  minAge: MIN_AGE,
  maxAge: MAX_AGE,
  minWeightKg: MIN_WEIGHT_KG,
}

export function calculateAge(
  dateOfBirth: Date | null,
  now: Date = new Date()
): number | null {
  if (!dateOfBirth) {
    return null
  }

  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear()

  if (
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age--
  }

  return age
}

function latestDonationDate(
  lastDonation: Date | null,
  history: Date[]
): Date | null {
  return history.reduce<Date | null>(
    (latest, date) =>
      !latest || date > latest ? date : latest,
    lastDonation
  )
}

export function computeEligibility(
  profile: EligibilityProfileInput,
  donationDates: Date[] = [],
  now: Date = new Date(),
  config: EligibilityConfig = DEFAULT_ELIGIBILITY_CONFIG
): EligibilityResult {
  const checks: EligibilityCheck[] = []

  const age = calculateAge(profile.dateOfBirth, now)

  const agePassed =
    age !== null &&
    age >= config.minAge &&
    age <= config.maxAge

  checks.push({
    key: 'age',
    label: `Age between ${config.minAge} and ${config.maxAge}`,
    passed: agePassed,
    detail:
      age === null
        ? 'Date of birth is missing.'
        : `You are ${age} years old.`,
  })

  const weightPassed = profile.weight >= config.minWeightKg

  checks.push({
    key: 'weight',
    label: `Weigh at least ${config.minWeightKg} kg`,
    passed: weightPassed,
    detail: `Your recorded weight is ${profile.weight} kg.`,
  })

  const medicallyApproved =
    profile.verificationStatus === 'VERIFIED'

  checks.push({
    key: 'medical',
    label: 'Medical report approved',
    passed: medicallyApproved,
    detail:
      profile.verificationStatus === 'REJECTED'
        ? 'Your medical report was rejected. Please contact the reviewing facility.'
        : profile.verificationStatus ===
            'ADDITIONAL_INFO_REQUIRED'
          ? 'More information is required before your medical report can be approved.'
          : medicallyApproved
            ? 'Your medical report is approved.'
            : 'Your medical report is still under review.',
  })

  const latest = latestDonationDate(
    profile.lastDonation,
    donationDates
  )

  let daysUntilEligible: number | null = null
  let nextEligibleDate: string | null = null
  let intervalPassed = true

  if (latest) {
    const nextEligible = new Date(
      latest.getTime() +
        profile.donationIntervalDays * DAY_MS
    )

    if (nextEligible > now) {
      intervalPassed = false
      nextEligibleDate = nextEligible.toISOString().slice(0, 10)
      daysUntilEligible = Math.ceil(
        (nextEligible.getTime() - now.getTime()) / DAY_MS
      )
    }
  }

  checks.push({
    key: 'interval',
    label: `Wait ${profile.donationIntervalDays} days between donations`,
    passed: intervalPassed,
    detail: intervalPassed
      ? 'Enough time has passed since your last donation.'
      : `You can donate again on ${nextEligibleDate}.`,
  })

  const availabilityPassed =
    profile.currentAvailability === 'AVAILABLE'

  checks.push({
    key: 'availability',
    label: 'Marked as available',
    passed: availabilityPassed,
    informational: true,
    detail: availabilityPassed
      ? 'You are currently available to donate.'
      : 'You are currently unavailable. This does not affect medical approval.',
  })

  const eligible =
    agePassed &&
    weightPassed &&
    medicallyApproved &&
    intervalPassed

  let status: EligibilityStatus

  if (!medicallyApproved) {
    status =
      profile.verificationStatus === 'REJECTED'
        ? 'NOT_ELIGIBLE'
        : 'PENDING_VERIFICATION'
  } else {
    status = eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
  }

  return {
    eligible,
    status,
    medicallyApproved,
    nextEligibleDate,
    daysUntilEligible,
    checks,
  }
}
