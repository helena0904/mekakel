import { Prisma, type BloodUnitStatus } from '@prisma/client'

import { AppError } from '../lib/errors'
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
  screenedBy: number | null
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

type StockFields = Pick<
  SerializableBloodUnit,
  'screeningStatus' | 'confirmationStatus' | 'expiryDate'
>

export function isEligibleStock(
  unit: StockFields,
  now: Date = new Date()
): boolean {
  return (
    unit.screeningStatus === 'PASSED' &&
    unit.confirmationStatus === 'CONFIRMED' &&
    !isExpired(unit, now)
  )
}

export function isAvailableStock(
  unit: Pick<SerializableBloodUnit, 'status'> & StockFields,
  now: Date = new Date()
): boolean {
  return unit.status === 'AVAILABLE' && isEligibleStock(unit, now)
}

export function deriveUnitStatus(
  unit: StockFields,
  now: Date = new Date(),
  currentStatus?: string
): BloodUnitStatus {
  if (currentStatus === 'USED' || currentStatus === 'DISCARDED') {
    return currentStatus
  }

  if (
    unit.screeningStatus === 'FAILED' ||
    unit.confirmationStatus === 'REJECTED'
  ) {
    return 'DISCARDED'
  }

  if (isExpired(unit, now)) {
    return 'EXPIRED'
  }

  if (isEligibleStock(unit, now)) {
    return 'AVAILABLE'
  }

  return 'PENDING'
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

const SCREENED_STATUSES = ['PASSED', 'FAILED']

const AUTOMATED_STATUSES = [
  'RESERVED',
  'TRANSFERRED',
  'EXPIRED',
]

export async function createUnits(
  hospitalProfileId: number,
  userId: number,
  data: CreateBloodUnitInput
) {
  const now = new Date()
  const screeningStatus = data.screeningStatus ?? 'PENDING'
  const confirmationStatus =
    data.confirmationStatus ?? 'PENDING'
  const expiryDate = new Date(data.expiryDate)
  const quantity = data.quantity ?? 1

  const status = deriveUnitStatus(
    {
      screeningStatus,
      confirmationStatus,
      expiryDate,
    },
    now
  )

  const rows = Array.from({ length: quantity }, (_, index) => ({
    hospitalProfileId,
    bagId:
      quantity > 1
        ? `${data.bagId}-${index + 1}`
        : data.bagId,
    bloodType: data.bloodType,
    component: data.component ?? 'RED_CELLS',
    collectionDate: new Date(data.collectionDate),
    expiryDate,
    screeningStatus,
    confirmationStatus,
    status,
    storageLocation: data.storageLocation || null,
    storageNotes: data.storageNotes || null,
    screenedBy: SCREENED_STATUSES.includes(screeningStatus)
      ? userId
      : null,
    screenedAt: SCREENED_STATUSES.includes(screeningStatus)
      ? now
      : null,
    confirmedAt:
      confirmationStatus === 'CONFIRMED' ||
      confirmationStatus === 'REJECTED'
        ? now
        : null,
    createdByUserId: userId,
  }))

  return prisma.$transaction(
    rows.map((row) => prisma.bloodUnit.create({ data: row }))
  )
}

async function assertStockEditable(unitId: number) {
  const [reservation, transfer] = await Promise.all([
    prisma.reservation.findFirst({
      where: {
        bloodUnitId: unitId,
        status: { in: ['ACTIVE', 'CONFIRMED'] },
      },
      select: { id: true },
    }),
    prisma.transfer.findFirst({
      where: {
        bloodUnitId: unitId,
        status: {
          in: [
            'REQUESTED',
            'APPROVED',
            'DISPATCHED',
            'RECEIVED',
          ],
        },
      },
      select: { id: true },
    }),
  ])

  if (reservation) {
    throw new AppError(
      'Release the active reservation before changing this unit',
      409
    )
  }

  if (transfer) {
    throw new AppError(
      'Complete or cancel the active transfer before changing this unit',
      409
    )
  }
}

export async function updateUnit(
  unitId: number,
  data: UpdateBloodUnitInput,
  userId?: number
) {
  const existing = await prisma.bloodUnit.findUnique({
    where: { id: unitId },
  })

  if (!existing) {
    throw new AppError('Blood unit not found', 404)
  }

  const stockFieldsChanged = [
    data.screeningStatus,
    data.confirmationStatus,
    data.expiryDate,
    data.status,
  ].some((value) => value !== undefined)

  if (stockFieldsChanged) {
    await assertStockEditable(unitId)
  }

  if (
    data.status &&
    AUTOMATED_STATUSES.includes(data.status)
  ) {
    throw new AppError(
      'This status is managed automatically by reservations, transfers and expiry checks',
      400
    )
  }

  const now = new Date()
  const screeningStatus =
    data.screeningStatus ?? existing.screeningStatus
  const confirmationStatus =
    data.confirmationStatus ?? existing.confirmationStatus
  const expiryDate = data.expiryDate
    ? new Date(data.expiryDate)
    : existing.expiryDate

  let status: BloodUnitStatus = deriveUnitStatus(
    { screeningStatus, confirmationStatus, expiryDate },
    now,
    existing.status
  )

  if (data.status === 'USED' || data.status === 'DISCARDED') {
    status = data.status
  }

  const screeningChanged =
    data.screeningStatus !== undefined &&
    data.screeningStatus !== existing.screeningStatus

  const confirmationChanged =
    data.confirmationStatus !== undefined &&
    data.confirmationStatus !== existing.confirmationStatus

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
        ? expiryDate
        : undefined,
      screeningStatus: data.screeningStatus,
      confirmationStatus: data.confirmationStatus,
      status,
      storageLocation:
        data.storageLocation === undefined
          ? undefined
          : data.storageLocation || null,
      storageNotes:
        data.storageNotes === undefined
          ? undefined
          : data.storageNotes || null,
      screenedBy:
        screeningChanged && userId
          ? SCREENED_STATUSES.includes(screeningStatus)
            ? userId
            : null
          : undefined,
      screenedAt: screeningChanged
        ? SCREENED_STATUSES.includes(screeningStatus)
          ? now
          : null
        : undefined,
      confirmedAt: confirmationChanged
        ? confirmationStatus === 'CONFIRMED' ||
          confirmationStatus === 'REJECTED'
          ? now
          : null
        : undefined,
    },
  })
}

export function deleteUnit(unitId: number) {
  return prisma.bloodUnit.delete({ where: { id: unitId } })
}

export async function expireOverdueUnits(now: Date = new Date()) {
  const result = await prisma.bloodUnit.updateMany({
    where: {
      status: {
        in: ['PENDING', 'AVAILABLE', 'RESERVED', 'TRANSFERRED'],
      },
      expiryDate: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })

  return result.count
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

    if (
      unit.status === 'EXPIRED' ||
      (unit.status === 'AVAILABLE' && isExpired(unit, now))
    ) {
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
      status: {
        notIn: ['USED', 'DISCARDED', 'TRANSFERRED'],
      },
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
