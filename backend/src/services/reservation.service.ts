import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import { AppError, isAppError } from '../lib/errors'
import {
  isAvailableStock,
  isEligibleStock,
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
import { recordAuditSafely } from './audit.service'
import { computeEligibility } from './eligibility.service'
import { getEligibilityConfig } from './settings.service'
import type { NotificationTypeValue } from '../validators/notification.schema'

const reservationInclude = {
  bloodUnit: true,
  donorProfile: {
    select: {
      id: true,
      phone: true,
      additionalPhone: true,
      address: true,
      bloodType: true,
      consentToContact: true,
      shareLocation: true,
      verificationStatus: true,
      user: { select: { name: true, isActive: true } },
    },
  },
  bloodRequest: {
    select: {
      id: true,
      bloodType: true,
      component: true,
      requiredUnits: true,
      status: true,
    },
  },
  hospitalProfile: {
    select: {
      id: true,
      hospitalName: true,
      address: true,
      subcity: true,
      wereda: true,
      phone: true,
    },
  },
} satisfies Prisma.ReservationInclude

export type ReservationWithRelations =
  Prisma.ReservationGetPayload<{
    include: typeof reservationInclude
  }>

type SerializedReservationDonor = Omit<
  NonNullable<ReservationWithRelations['donorProfile']>,
  'address'
> & {
  address: string | null
}

export type SerializedReservation = Omit<
  ReservationWithRelations,
  'bloodUnit' | 'donorProfile'
> & {
  bloodUnit: SerializedBloodUnit | null
  donorProfile: SerializedReservationDonor | null
  isExpired: boolean
}

export function serializeReservation(
  reservation: ReservationWithRelations,
  now: Date = new Date()
): SerializedReservation {
  const donorProfile = reservation.donorProfile
    ? {
        ...reservation.donorProfile,
        // Exact donor location is only released after the donor accepts.
        address:
          reservation.donorResponse === 'ACCEPTED'
            ? reservation.donorProfile.address
            : null,
      }
    : null

  return {
    ...reservation,
    isExpired: reservation.expiresAt.getTime() < now.getTime(),
    bloodUnit: reservation.bloodUnit
      ? serializeUnit(reservation.bloodUnit, now)
      : null,
    donorProfile,
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
        unitBagId: reservation.bloodUnit?.bagId,
        bloodType: reservation.bloodUnit?.bloodType,
        component: reservation.bloodUnit?.component,
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

function buildDonorWhere(
  donorProfileId: number,
  filters: ListReservationsQuery
): Prisma.ReservationWhereInput {
  const where: Prisma.ReservationWhereInput = {
    donorProfileId,
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
    bloodTypeConfirmed: boolean
    expiryDate: Date
  },
  now: Date
): 'AVAILABLE' | 'EXPIRED' | 'DISCARDED' | 'PENDING' {
  if (
    unit.screeningStatus === 'FAILED' ||
    unit.confirmationStatus === 'REJECTED'
  ) {
    return 'DISCARDED'
  }

  if (isExpired(unit, now)) {
    return 'EXPIRED'
  }

  if (!isEligibleStock(unit, now)) {
    return 'PENDING'
  }

  return 'AVAILABLE'
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

export async function listDonorReservations(
  donorProfileId: number,
  filters: ListReservationsQuery = {}
): Promise<SerializedReservation[]> {
  const now = new Date()

  const reservations = await prisma.reservation.findMany({
    where: buildDonorWhere(donorProfileId, filters),
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

  try {
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
            select: {
              id: true,
              dateOfBirth: true,
              weight: true,
              verificationStatus: true,
              currentAvailability: true,
              lastDonation: true,
              donationIntervalDays: true,
              consentToContact: true,
              matchingOptOut: true,
              user: { select: { isActive: true } },
              donationHistory: {
                select: { donatedAt: true },
              },
            },
          })

          if (!donor) {
            throw new AppError('Donor not found', 404)
          }

          if (
            !donor.user.isActive ||
            !donor.consentToContact ||
            donor.matchingOptOut ||
            donor.currentAvailability !== 'AVAILABLE'
          ) {
            throw new AppError(
              'This donor is not currently available for contact or matching',
              409
            )
          }

          const eligibility = computeEligibility(
            donor,
            donor.donationHistory.map(
              (record) => record.donatedAt
            ),
            now,
            await getEligibilityConfig()
          )

          if (!eligibility.eligible) {
            throw new AppError(
              'The donor is not currently eligible to donate',
              409
            )
          }
        }

        let unit: Prisma.BloodUnitGetPayload<{}> | null = null

        if (data.bloodUnitId !== undefined) {
          unit = await tx.bloodUnit.findFirst({
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
              bloodTypeConfirmed: true,
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
        }

        return tx.reservation.create({
          data: {
            bloodUnitId: unit?.id ?? null,
            bloodRequestId: data.bloodRequestId ?? null,
            hospitalProfileId,
            donorProfileId: data.donorProfileId ?? null,
            kind: unit ? 'BLOOD_UNIT' : 'DONOR',
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError(
        'This donor or blood unit already has an active reservation',
        409
      )
    }

    throw error
  }
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
      if (existing.bloodUnitId && existing.bloodUnit) {
        const targetUnitStatus = resolveTargetUnitStatus(
          existing.bloodUnit,
          now
        )

        await tx.bloodUnit.updateMany({
          where: {
            id: existing.bloodUnitId,
            status: 'RESERVED',
          },
          data: { status: targetUnitStatus },
        })
      }

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

      if (
        existing.kind === 'DONOR' &&
        existing.donorResponse !== 'ACCEPTED'
      ) {
        throw new AppError(
          'The donor must accept before this reservation can be confirmed',
          409
        )
      }

      if (
        existing.bloodUnit &&
        !isAvailableStock(
          { ...existing.bloodUnit, status: 'AVAILABLE' },
          now
        )
      ) {
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

      if (!existing.bloodUnitId) {
        throw new AppError(
          'This is a donor coordination reservation and has no blood unit to consume',
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

      if (existing.bloodUnitId) {
        await tx.bloodUnit.updateMany({
          where: {
            id: existing.bloodUnitId,
            status: 'RESERVED',
          },
          data: { status: 'USED' },
        })
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
        'RESERVATION_CONSUMED'
      )

      return serialized
    })
}

export function recordDonorResponse(
  donorProfileId: number,
  reservationId: number,
  data: DonorResponseInput
): Promise<SerializedReservation> {
  const now = new Date()
  const terminal = data.donorResponse === 'DECLINED'

  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.reservation.findFirst({
        where: { id: reservationId, donorProfileId },
        include: { bloodUnit: true },
      })

      if (!existing) {
        throw new AppError('Reservation not found', 404)
      }

      if (existing.expiresAt.getTime() <= now.getTime()) {
        throw new AppError(
          'This reservation has expired and can no longer be answered',
          409
        )
      }

      if (existing.status !== 'ACTIVE') {
        throw new AppError(
          'This reservation is no longer open for a donor response',
          409
        )
      }

      if (existing.donorResponse !== 'PENDING') {
        throw new AppError(
          'A donor response has already been recorded',
          409
        )
      }

      const updated = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          donorProfileId,
          status: 'ACTIVE',
          donorResponse: 'PENDING',
          expiresAt: { gt: now },
        },
        data: {
          donorResponse: data.donorResponse,
          donorRespondedAt: now,
          status: terminal ? 'CANCELLED' : 'CONFIRMED',
          confirmedAt: terminal ? null : now,
          cancelledAt: terminal ? now : null,
          reason: terminal
            ? data.note || 'Donor declined the request'
            : existing.reason,
          notes: data.note ? data.note : undefined,
        },
      })

      if (updated.count !== 1) {
        throw new AppError(
          'Reservation state changed, please retry',
          409
        )
      }

      if (
        terminal &&
        existing.bloodUnitId &&
        existing.bloodUnit
      ) {
        await tx.bloodUnit.updateMany({
          where: {
            id: existing.bloodUnitId,
            status: 'RESERVED',
          },
          data: {
            status: resolveTargetUnitStatus(
              existing.bloodUnit,
              now
            ),
          },
        })
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
        terminal
          ? 'RESERVATION_CANCELLED'
          : 'RESERVATION_CONFIRMED',
        terminal ? serialized.reason : null
      )

      return serialized
    })
}

export async function expireDueReservations(
  now: Date = new Date()
): Promise<{ scanned: number; expired: number }> {
  const due = await prisma.reservation.findMany({
    where: {
      status: { in: ['ACTIVE', 'CONFIRMED'] },
      OR: [
        { expiresAt: { lte: now } },
        {
          bloodUnit: {
            is: { expiryDate: { lte: now } },
          },
        },
        {
          bloodUnit: {
            is: { screeningStatus: 'FAILED' },
          },
        },
        {
          bloodUnit: {
            is: { confirmationStatus: 'REJECTED' },
          },
        },
      ],
    },
    select: { id: true },
  })

  let expired = 0

  for (const { id } of due) {
    try {
      const reservation = await transitionToTerminal(
        null,
        id,
        'EXPIRED',
        'Reservation expired or the unit became ineligible'
      )

      await recordAuditSafely({
        action: 'RESERVATION_EXPIRED',
        entityType: 'Reservation',
        entityId: reservation.id,
        summary: 'Reservation expired or the unit became ineligible',
      })

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
