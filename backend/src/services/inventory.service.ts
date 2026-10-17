import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import { BLOOD_TYPES } from '../validators/donor.schema'
import type {
  CreateBloodUnitInput,
  ListBloodUnitsQuery,
  UpdateBloodUnitInput,
} from '../validators/inventory.schema'

const DAY_MS = 24 * 60 * 60 * 1000

export interface SerializableBloodUnit {
  id: number
  hospitalProfileId: number
  bagId: string
  bloodType: string
  component: string
  collectionDate: Date
  expiryDate: Date
  screeningStatus: string
  confirmationStatus: string
  status: string
  storageLocation: string | null
  storageNotes: string | null
  screenedAt: Date | null
  confirmedAt: Date | null
  createdByUserId: number | null
  createdAt: Date
  updatedAt: Date
}

export interface SerializedBloodUnit extends SerializableBloodUnit {
  isExpired: boolean
  isAvailable: boolean
  daysUntilExpiry: number
}

export function isExpired(
  unit: Pick<SerializableBloodUnit, 'expiryDate'>,
  now: Date = new Date()
): boolean {
  return unit.expiryDate.getTime() < now.getTime()
}

export function isAvailableStock(
  unit: Pick<
    SerializableBloodUnit,
    | 'status'
    | 'screeningStatus'
    | 'confirmationStatus'
    | 'expiryDate'
  >,
  now: Date = new Date()
): boolean {
  return (
    unit.status === 'AVAILABLE' &&
    unit.screeningStatus === 'PASSED' &&
    unit.confirmationStatus === 'CONFIRMED' &&
    !isExpired(unit, now)
  )
}

export function serializeUnit(
  unit: SerializableBloodUnit,
  now: Date = new Date()
): SerializedBloodUnit {
  return {
    ...unit,
    isExpired: isExpired(unit, now),
    isAvailable: isAvailableStock(unit, now),
    daysUntilExpiry: Math.ceil(
      (unit.expiryDate.getTime() - now.getTime()) / DAY_MS
    ),
  }
}

function buildWhere(
  hospitalProfileId: number,
  filters: ListBloodUnitsQuery,
  now: Date
): Prisma.BloodUnitWhereInput {
  const where: Prisma.BloodUnitWhereInput = {
    hospitalProfileId,
  }

  if (filters.bloodType) {
    where.bloodType = filters.bloodType
  }

  if (filters.component) {
    where.component = filters.component
  }

  if (filters.search) {
    where.bagId = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  const availability =
    filters.availability === 'available' ? 'AVAILABLE' : undefined

  where.status = availability ?? filters.status

  if (availability) {
    where.screeningStatus = 'PASSED'
    where.confirmationStatus = 'CONFIRMED'
  } else {
    if (filters.screeningStatus) {
      where.screeningStatus = filters.screeningStatus
    }

    if (filters.confirmationStatus) {
      where.confirmationStatus = filters.confirmationStatus
    }
  }

  if (filters.expiringWithinDays !== undefined) {
    where.expiryDate = {
      gte: now,
      lte: new Date(
        now.getTime() + filters.expiringWithinDays * DAY_MS
      ),
    }
  } else if (availability) {
    where.expiryDate = { gte: now }
  }

  return where
}

export async function listUnits(
  hospitalProfileId: number,
  filters: ListBloodUnitsQuery
) {
  const now = new Date()

  const units = await prisma.bloodUnit.findMany({
    where: buildWhere(hospitalProfileId, filters, now),
    orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
  })

  return units.map((unit) => serializeUnit(unit, now))
}

export function findUnit(
  hospitalProfileId: number,
  unitId: number
) {
  return prisma.bloodUnit.findFirst({
    where: { id: unitId, hospitalProfileId },
  })
}

export function createUnit(
  hospitalProfileId: number,
  userId: number,
  data: CreateBloodUnitInput
) {
  const screeningStatus = data.screeningStatus ?? 'PENDING'
  const confirmationStatus =
    data.confirmationStatus ?? 'PENDING'

  return prisma.bloodUnit.create({
    data: {
      hospitalProfileId,
      bagId: data.bagId,
      bloodType: data.bloodType,
      component: data.component ?? 'RED_CELLS',
      collectionDate: new Date(data.collectionDate),
      expiryDate: new Date(data.expiryDate),
      screeningStatus,
      confirmationStatus,
      status: data.status ?? 'AVAILABLE',
      storageLocation: data.storageLocation || null,
      storageNotes: data.storageNotes || null,
      screenedAt:
        screeningStatus === 'PASSED' ||
        screeningStatus === 'FAILED'
          ? new Date()
          : null,
      confirmedAt:
        confirmationStatus === 'CONFIRMED' ||
        confirmationStatus === 'REJECTED'
          ? new Date()
          : null,
      createdByUserId: userId,
    },
  })
}

export function updateUnit(
  unitId: number,
  data: UpdateBloodUnitInput
) {
  const screeningStatus = data.screeningStatus
  const confirmationStatus = data.confirmationStatus

  return prisma.bloodUnit.update({
    where: { id: unitId },
    data: {
      bagId: data.bagId,
      bloodType: data.bloodType,
      component: data.component,
      collectionDate: data.collectionDate
        ? new Date(data.collectionDate)
        : undefined,
      expiryDate: data.expiryDate
        ? new Date(data.expiryDate)
        : undefined,
      screeningStatus,
      confirmationStatus,
      status: data.status,
      storageLocation:
        data.storageLocation === undefined
          ? undefined
          : data.storageLocation || null,
      storageNotes:
        data.storageNotes === undefined
          ? undefined
          : data.storageNotes || null,
      screenedAt:
        screeningStatus === 'PASSED' ||
        screeningStatus === 'FAILED'
          ? new Date()
          : screeningStatus === 'PENDING'
            ? null
            : undefined,
      confirmedAt:
        confirmationStatus === 'CONFIRMED' ||
        confirmationStatus === 'REJECTED'
          ? new Date()
          : confirmationStatus === 'PENDING'
            ? null
            : undefined,
    },
  })
}

export function deleteUnit(unitId: number) {
  return prisma.bloodUnit.delete({ where: { id: unitId } })
}

interface TypeSummary {
  bloodType: string
  totalUnits: number
  availableUnits: number
  expiredUnits: number
  pendingScreening: number
  pendingConfirmation: number
}

export async function getSummary(hospitalProfileId: number) {
  const now = new Date()

  const units = await prisma.bloodUnit.findMany({
    where: { hospitalProfileId },
    select: {
      bloodType: true,
      status: true,
      screeningStatus: true,
      confirmationStatus: true,
      expiryDate: true,
    },
  })

  const byType = new Map<string, TypeSummary>()

  for (const bloodType of BLOOD_TYPES) {
    byType.set(bloodType, {
      bloodType,
      totalUnits: 0,
      availableUnits: 0,
      expiredUnits: 0,
      pendingScreening: 0,
      pendingConfirmation: 0,
    })
  }

  for (const unit of units) {
    const summary = byType.get(unit.bloodType)

    if (!summary) {
      continue
    }

    summary.totalUnits += 1

    if (unit.status === 'AVAILABLE' && isExpired(unit, now)) {
      summary.expiredUnits += 1
    }

    if (isAvailableStock(unit, now)) {
      summary.availableUnits += 1
    }

    if (unit.screeningStatus !== 'PASSED') {
      summary.pendingScreening += 1
    }

    if (unit.confirmationStatus !== 'CONFIRMED') {
      summary.pendingConfirmation += 1
    }
  }

  const types = [...byType.values()]

  const totals = types.reduce(
    (accumulator, type) => ({
      totalUnits:
        accumulator.totalUnits + type.totalUnits,
      availableUnits:
        accumulator.availableUnits + type.availableUnits,
      expiredUnits:
        accumulator.expiredUnits + type.expiredUnits,
      pendingScreening:
        accumulator.pendingScreening +
        type.pendingScreening,
      pendingConfirmation:
        accumulator.pendingConfirmation +
        type.pendingConfirmation,
    }),
    {
      totalUnits: 0,
      availableUnits: 0,
      expiredUnits: 0,
      pendingScreening: 0,
      pendingConfirmation: 0,
    }
  )

  return { types, totals, generatedAt: now }
}

export async function getExpiryAlerts(
  hospitalProfileId: number,
  withinDays = 7
) {
  const now = new Date()

  const units = await prisma.bloodUnit.findMany({
    where: {
      hospitalProfileId,
      status: { notIn: ['USED', 'DISCARDED'] },
      expiryDate: {
        lte: new Date(now.getTime() + withinDays * DAY_MS),
      },
    },
    orderBy: [{ expiryDate: 'asc' }],
  })

  return units.map((unit) => {
    const serialized = serializeUnit(unit, now)

    return {
      ...serialized,
      isExpired: serialized.isExpired,
      status: serialized.isExpired
        ? 'EXPIRED'
        : 'EXPIRING_SOON',
    }
  })
}
