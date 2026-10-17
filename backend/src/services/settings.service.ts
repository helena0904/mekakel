import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import {
  DEFAULT_COMPATIBILITY_CONFIG,
  type CompatibilityConfig,
} from './compatibility.service'
import {
  DEFAULT_ELIGIBILITY_CONFIG,
  type EligibilityConfig,
} from './eligibility.service'
import {
  recordAudit,
  type AuditActor,
} from './audit.service'

export const ELIGIBILITY_SETTING_KEY = 'eligibility'
export const COMPATIBILITY_SETTING_KEY = 'compatibility'

export interface GovernanceSettings {
  eligibility: EligibilityConfig
  compatibility: CompatibilityConfig
}

export interface UpdateGovernanceSettingsInput {
  eligibility?: Partial<EligibilityConfig>
  compatibility?: Partial<CompatibilityConfig>
}

const ELIGIBILITY_BOUNDS = {
  minAge: { min: 0, max: 120 },
  maxAge: { min: 0, max: 120 },
  minWeightKg: { min: 1, max: 300 },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function readNumber(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < bounds.min ||
    value > bounds.max
  ) {
    return fallback
  }

  return value
}

function parseEligibility(value: unknown): EligibilityConfig {
  if (!isRecord(value)) {
    return { ...DEFAULT_ELIGIBILITY_CONFIG }
  }

  const minAge = readNumber(
    value.minAge,
    DEFAULT_ELIGIBILITY_CONFIG.minAge,
    ELIGIBILITY_BOUNDS.minAge,
  )
  const maxAge = readNumber(
    value.maxAge,
    DEFAULT_ELIGIBILITY_CONFIG.maxAge,
    ELIGIBILITY_BOUNDS.maxAge,
  )

  return {
    minAge: Math.min(minAge, maxAge),
    maxAge: Math.max(minAge, maxAge),
    minWeightKg: readNumber(
      value.minWeightKg,
      DEFAULT_ELIGIBILITY_CONFIG.minWeightKg,
      ELIGIBILITY_BOUNDS.minWeightKg,
    ),
  }
}

function parseCompatibility(value: unknown): CompatibilityConfig {
  if (!isRecord(value)) {
    return { ...DEFAULT_COMPATIBILITY_CONFIG }
  }

  return {
    enforceRh:
      typeof value.enforceRh === 'boolean'
        ? value.enforceRh
        : DEFAULT_COMPATIBILITY_CONFIG.enforceRh,
    plasmaReversed:
      typeof value.plasmaReversed === 'boolean'
        ? value.plasmaReversed
        : DEFAULT_COMPATIBILITY_CONFIG.plasmaReversed,
  }
}

export async function getEligibilityConfig(): Promise<EligibilityConfig> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: ELIGIBILITY_SETTING_KEY },
    select: { value: true },
  })

  return parseEligibility(setting?.value)
}

export async function getCompatibilityConfig(): Promise<CompatibilityConfig> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: COMPATIBILITY_SETTING_KEY },
    select: { value: true },
  })

  return parseCompatibility(setting?.value)
}

export async function getAllSettings(): Promise<GovernanceSettings> {
  const [eligibility, compatibility] = await Promise.all([
    getEligibilityConfig(),
    getCompatibilityConfig(),
  ])

  return { eligibility, compatibility }
}

export async function updateSettings(
  input: UpdateGovernanceSettingsInput,
  actor: AuditActor = {},
): Promise<GovernanceSettings> {
  const eligibility =
    input.eligibility === undefined
      ? undefined
      : parseEligibility({
          ...DEFAULT_ELIGIBILITY_CONFIG,
          ...input.eligibility,
        })

  const compatibility =
    input.compatibility === undefined
      ? undefined
      : parseCompatibility({
          ...DEFAULT_COMPATIBILITY_CONFIG,
          ...input.compatibility,
        })

  await prisma.$transaction(async (tx) => {
    if (eligibility) {
      await tx.systemSetting.upsert({
        where: { key: ELIGIBILITY_SETTING_KEY },
        create: {
          key: ELIGIBILITY_SETTING_KEY,
          value: eligibility as unknown as Prisma.InputJsonValue,
          description:
            'Donation eligibility screening thresholds',
          updatedByUserId: actor.userId ?? null,
          updatedByName: actor.name ?? null,
        },
        update: {
          value: eligibility as unknown as Prisma.InputJsonValue,
          updatedByUserId: actor.userId ?? null,
          updatedByName: actor.name ?? null,
        },
      })
    }

    if (compatibility) {
      await tx.systemSetting.upsert({
        where: { key: COMPATIBILITY_SETTING_KEY },
        create: {
          key: COMPATIBILITY_SETTING_KEY,
          value: compatibility as unknown as Prisma.InputJsonValue,
          description:
            'Preliminary blood compatibility governance rules',
          updatedByUserId: actor.userId ?? null,
          updatedByName: actor.name ?? null,
        },
        update: {
          value: compatibility as unknown as Prisma.InputJsonValue,
          updatedByUserId: actor.userId ?? null,
          updatedByName: actor.name ?? null,
        },
      })
    }

    await recordAudit(
      {
        ...actor,
        action: 'SETTINGS_UPDATED',
        entityType: 'SystemSetting',
        summary:
          'Updated governance settings',
        metadata: {
          eligibility: eligibility ?? null,
          compatibility: compatibility ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
      tx,
    )
  })

  return getAllSettings()
}
