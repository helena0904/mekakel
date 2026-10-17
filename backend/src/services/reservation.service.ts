import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import { AppError, isAppError } from '../lib/errors'
import {
  isAvailableStock,
  isExpired,
  serializeUnit,
} from './inventory.service'
import type { SerializedBloodUnit } from './inventory.service'
import {
  DEFAULT_RESERVATION_TTL_MINUTES,
} from '../validators/reservation.schema'
import type {
  CreateReservationInput,
  DonorResponseInput,
  ListReservationsQuery,
} from '../validators/reservation.schema'
import { notifyHospitalOwner } from './notification.service'
import type { NotificationTypeValue } from '../validators/notification.schema'

const reservationInclude = {
  bloodUnit: true,
  bloodRequest: {
    select: {
      id: true,
      bloodType: true,
      component: true,
      requiredUnits: true,
      status: true,
    },
  },
} satisfies Prisma.ReservationInclude

export type ReservationWithRelations =
  Prisma.ReservationGetPayload<{
    include: typeof reservationInclude
  }>

export type SerializedReservation = Omit<
  ReservationWithRelations,
  'bloodUnit'
> & {
  bloodUnit: SerializedBloodUnit
  isExpired: boolean
}

export function serializeReservation(
  reservation: ReservationWithRelations,
  now: Date = new Date()
): SerializedReservation {
  return {
    ...reservation,
    isExpired: reservation.expiresAt.getTime() < now.getTime(),
    bloodUnit: serializeUnit(reservation.bloodUnit, now),
  }
}

async function notifyReservationOwner(
  reservation: SerializedReservation,
  type: NotificationTypeValue,
  reason?: string | null
): Promise<void> {
  try {
    await notifyHospitalOwner(
      reservation.hospitalProfileId,
      type,
      {
        reservationId: reservation.id,
        unitBagId: reservation.bloodUnit.bagId,
        bloodType: reservation.bloodUnit.bloodType,
        component: reservation.bloodUnit.component,
        reason: reason ?? undefined,
      },
      {
        relatedEntityType: 'Reservation',
        relatedEntityId: reservation.id,
        dedupeKey: `reservation:${reservation.id}:${type}`,
      }
    )
  } catch (error) {
    console.error(
      '[reservation] notification failed',
      error
    )
  }
}

function buildWhere(
  hospitalProfileId: number,
  filters: ListReservationsQuery
): Prisma.ReservationWhereInput {
  const where: Prisma.ReservationWhereInput = {
    hospitalProfileId,
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.bloodUnitId) {
    where.bloodUnitId = filters.bloodUnitId
  }

  if (filters.bloodRequestId) {
    where.bloodRequestId = filters.bloodRequestId
  }

  return where
}

export function resolveTargetUnitStatus(
  unit: {
    screeningStatus: string
    confirmationStatus: string
    expiryDate: Date
  },
  now: Date
): 'AVAILABLE' | 'DISCARDED' {
  const stillEligible =
    unit.screeningStatus === 'PASSED' &&
    unit.confirmationStatus === 'CONFIRMED' &&
    !isExpired(unit, now)

  return stillEligible ? 'AVAILABLE' : 'DISCARDED'
}

export async function listReservations(
  hospitalProfileId: number,
  filters: ListReservationsQuery
): Promise<SerializedReservation[]> {
  const now = new Date()

  const reservations = await prisma.reservation.findMany({
    where: buildWhere(hospitalProfileId, filters),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: reservationInclude,
  })

  return reservations.map((reservation) =>
    serializeReservation(reservation, now)
  )
}

export async function findReservation(
  hospitalProfileId: number,
  reservationId: number
): Promise<SerializedReservation | null> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hospitalProfileId },
    include: reservationInclude,
  })

  return reservation
    ? serializeReservation(reservation)
    : null
}

export async function createReservation(
  hospitalProfileId: number,
  userId: number,
  data: CreateReservationInput
): Promise<SerializedReservation> {
  const now = new Date()
  const ttlMinutes =
    data.expiresInMinutes ?? DEFAULT_RESERVATION_TTL_MINUTES
  const expiresAt = new Date(
    now.getTime() + ttlMinutes * 60 * 1000
  )

  const reservation = await prisma.$transaction(
    async (tx) => {
      if (data.bloodRequestId) {
        const bloodRequest = await tx.bloodRequest.findFirst({
          where: {
            id: data.bloodRequestId,
            hospitalProfileId,
          },
          select: { id: true, status: true },
        })

        if (!bloodRequest) {
          throw new AppError('Blood request not found', 404)
        }

        if (bloodRequest.status !== 'OPEN') {
          throw new AppError(
            'Only open blood requests can be reserved against',
            409
          )
        }
      }

      if (data.donorProfileId) {
        const donor = await tx.donorProfile.findUnique({
          where: { id: data.donorProfileId },
          select: { id: true },
        })

        if (!donor) {
          throw new AppError('Donor not found', 404)
        }
      }

      const unit = await tx.bloodUnit.findFirst({
        where: {
          id: data.bloodUnitId,
          hospitalProfileId,
        },
      })

      if (!unit) {
        throw new AppError('Blood unit not found', 404)
      }

      if (!isAvailableStock(unit, now)) {
        throw new AppError(
          'Only screened, confirmed and unexpired available units can be reserved',
          409
        )
      }

      // Conditional, atomic claim: only one concurrent caller can flip
      // an available unit to RESERVED. Everyone else matches zero rows.
      const claimed = await tx.bloodUnit.updateMany({
        where: {
          id: unit.id,
          hospitalProfileId,
          status: 'AVAILABLE',
          screeningStatus: 'PASSED',
          confirmationStatus: 'CONFIRMED',
          expiryDate: { gt: now },
        },
        data: { status: 'RESERVED' },
      })

      if (claimed.count !== 1) {
        throw new AppError(
          'This blood unit is already reserved',
          409
        )
      }

      return tx.reservation.create({
        data: {
          bloodUnitId: unit.id,
          bloodRequestId: data.bloodRequestId ?? null,
          hospitalProfileId,
          donorProfileId: data.donorProfileId ?? null,
          status: 'ACTIVE',
          donorResponse: 'PENDING',
          expiresAt,
          notes: data.notes || null,
          createdByUserId: userId,
        },
        include: reservationInclude,
      })
    }
  )

  return serializeReservation(reservation)
}

async function transitionToTerminal(
  hospitalProfileId: number | null,
  reservationId: number,
  target: 'CANCELLED' | 'RELEASED' | 'EXPIRED',
  reason: string | null
): Promise<SerializedReservation> {
  const now = new Date()

  const reservation = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: {
          id: reservationId,
          ...(hospitalProfileId !== null
            ? { hospitalProfileId }
            : {}),
        },
        include: { bloodUnit: true },
      })

      if (!existing) {
        throw new AppError('Reservation not found', 404)
      }

      if (
        existing.status !== 'ACTIVE' &&
        existing.status !== 'CONFIRMED'
      ) {
        throw new AppError(
          `Reservation is already ${existing.status.toLowerCase()}`,
          409
        )
      }

      const update: Prisma.ReservationUpdateManyMutationInput = {
        status: target,
      }

      if (target === 'CANCELLED') {
        update.cancelledAt = now
      } else if (target === 'RELEASED') {
        update.releasedAt = now
      }

      if (reason) {
        update.reason = reason
      }

      const updated = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          status: { in: ['ACTIVE', 'CONFIRMED'] },
        },
        data: update,
      })

      if (updated.count !== 1) {
        throw new AppError(
          'Reservation state changed, please retry',
          409
        )
      }

      // Quality/expiry controls override the earlier reservation:
      // the unit only returns to AVAILABLE when it is still eligible.
      const targetUnitStatus = resolveTargetUnitStatus(
        existing.bloodUnit,
        now
      )

      await tx.bloodUnit.updateMany({
        where: { id: existing.bloodUnitId, status: 'RESERVED' },
        data: { status: targetUnitStatus },
      })

      return tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: reservationInclude,
      })
    }
  )

  const serialized = serializeReservation(reservation)

  await notifyReservationOwner(
    serialized,
    notificationTypeForTerminal(target),
    reason
  )

  return serialized
}

function notificationTypeForTerminal(
  target: 'CANCELLED' | 'RELEASED' | 'EXPIRED'
): NotificationTypeValue {
  switch (target) {
    case 'CANCELLED':
      return 'RESERVATION_CANCELLED'
    case 'RELEASED':
      return 'RESERVATION_RELEASED'
    default:
      return 'RESERVATION_EXPIRED'
  }
}

export function cancelReservation(
  hospitalProfileId: number,
  reservationId: number,
  reason?: string
): Promise<SerializedReservation> {
  return transitionToTerminal(
    hospitalProfileId,
    reservationId,
    'CANCELLED',
    reason ?? null
  )
}

export function releaseReservation(
  hospitalProfileId: number,
  reservationId: number,
  reason?: string
): Promise<SerializedReservation> {
  return transitionToTerminal(
    hospitalProfileId,
    reservationId,
    'RELEASED',
    reason ?? null
  )
}

export function confirmReservation(
  hospitalProfileId: number,
  reservationId: number
): Promise<SerializedReservation> {
  const now = new Date()

  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id: reservationId, hospitalProfileId },
        include: { bloodUnit: true },
      })

      if (!existing) {
        throw new AppError('Reservation not found', 404)
      }

      if (existing.status !== 'ACTIVE') {
        throw new AppError(
          `Only active reservations can be confirmed (current: ${existing.status.toLowerCase()})`,
          409
        )
      }

      if (!isAvailableStock({ ...existing.bloodUnit, status: 'AVAILABLE' }, now)) {
        throw new AppError(
          'The reserved unit is no longer eligible and cannot be confirmed',
          409
        )
      }

      const updated = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          hospitalProfileId,
          status: 'ACTIVE',
        },
        data: {
          status: 'CONFIRMED',
          confirmedAt: now,
        },
      })

      if (updated.count !== 1) {
        throw new AppError(
          'Reservation state changed, please retry',
          409
        )
      }

      return tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: reservationInclude,
      })
    })
    .then(async (reservation) => {
      const serialized = serializeReservation(reservation)

      await notifyReservationOwner(
        serialized,
        'RESERVATION_CONFIRMED'
      )

      return serialized
    })
}

export function consumeReservation(
  hospitalProfileId: number,
  reservationId: number
): Promise<SerializedReservation> {
  const now = new Date()

  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id: reservationId, hospitalProfileId },
        include: { bloodUnit: true },
      })

      if (!existing) {
        throw new AppError('Reservation not found', 404)
      }

      if (
        existing.status !== 'ACTIVE' &&
        existing.status !== 'CONFIRMED'
      ) {
        throw new AppError(
          `Only active or confirmed reservations can be used (current: ${existing.status.toLowerCase()})`,
          409
        )
      }

      const updated = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          hospitalProfileId,
          status: { in: ['ACTIVE', 'CONFIRMED'] },
        },
        data: {
          status: 'CONSUMED',
          consumedAt: now,
        },
      })

      if (updated.count !== 1) {
        throw new AppError(
          'Reservation state changed, please retry',
          409
        )
      }

      await tx.bloodUnit.updateMany({
        where: {
          id: existing.bloodUnitId,
          status: 'RESERVED',
        },
        data: { status: 'USED' },
      })

      return tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: reservationInclude,
      })
    })
    .then(async (reservation) => {
      const serialized = serializeReservation(reservation)

      await notifyReservationOwner(
        serialized,
        'RESERVATION_CONSUMED'
      )

      return serialized
    })
}

export function recordDonorResponse(
  hospitalProfileId: number,
  reservationId: number,
  data: DonorResponseInput
): Promise<SerializedReservation> {
  const now = new Date()

  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id: reservationId, hospitalProfileId },
        select: { id: true, status: true },
      })

      if (!existing) {
        throw new AppError('Reservation not found', 404)
      }

      if (
        existing.status !== 'ACTIVE' &&
        existing.status !== 'CONFIRMED'
      ) {
        throw new AppError(
          'Donor responses can only be recorded on active reservations',
          409
        )
      }

      return tx.reservation.update({
        where: { id: reservationId },
        data: {
          donorResponse: data.donorResponse,
          donorRespondedAt: now,
          notes: data.note ? data.note : undefined,
        },
        include: reservationInclude,
      })
    })
    .then((reservation) => serializeReservation(reservation))
}

export async function expireDueReservations(
  now: Date = new Date()
): Promise<{ scanned: number; expired: number }> {
  const due = await prisma.reservation.findMany({
    where: {
      status: { in: ['ACTIVE', 'CONFIRMED'] },
      OR: [
        { expiresAt: { lte: now } },
        { bloodUnit: { expiryDate: { lte: now } } },
        { bloodUnit: { screeningStatus: 'FAILED' } },
        { bloodUnit: { confirmationStatus: 'REJECTED' } },
      ],
    },
    select: { id: true },
  })

  let expired = 0

  for (const { id } of due) {
    try {
      await transitionToTerminal(
        null,
        id,
        'EXPIRED',
        'Reservation expired or the unit became ineligible'
      )
      expired += 1
    } catch (error) {
      // A concurrent transition won the race; skip it.
      if (!isAppError(error)) {
        throw error
      }
    }
  }

  return { scanned: due.length, expired }
}
