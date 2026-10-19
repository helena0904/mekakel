import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import { AppError } from '../lib/errors'
import {
  isAvailableStock,
  serializeUnit,
} from './inventory.service'
import type { SerializedBloodUnit } from './inventory.service'
import { resolveTargetUnitStatus } from './reservation.service'
import type {
  CreateTransferInput,
  ListTransfersQuery,
  TransferStatusValue,
} from '../validators/transfer.schema'
import { notifyHospitalOwner } from './notification.service'
import type { NotificationTypeValue } from '../validators/notification.schema'

const transferInclude = {
  bloodUnit: true,
  fromHospital: {
    select: {
      id: true,
      hospitalName: true,
      address: true,
      phone: true,
    },
  },
  toHospital: {
    select: {
      id: true,
      hospitalName: true,
      address: true,
      phone: true,
    },
  },
  events: { orderBy: { id: 'asc' } },
} satisfies Prisma.TransferInclude

export type TransferWithRelations = Prisma.TransferGetPayload<{
  include: typeof transferInclude
}>

export type SerializedTransfer = Omit<
  TransferWithRelations,
  'bloodUnit'
> & {
  bloodUnit: SerializedBloodUnit
}

export function serializeTransfer(
  transfer: TransferWithRelations,
  now: Date = new Date()
): SerializedTransfer {
  return {
    ...transfer,
    bloodUnit: serializeUnit(transfer.bloodUnit, now),
  }
}

async function notifyTransferCounterpart(
  transfer: SerializedTransfer,
  actorProfileId: number,
  type: NotificationTypeValue,
  note?: string
): Promise<void> {
  const actorIsFrom =
    transfer.fromHospitalProfileId === actorProfileId

  const recipientProfileId = actorIsFrom
    ? transfer.toHospitalProfileId
    : transfer.fromHospitalProfileId

  const actorName = actorIsFrom
    ? transfer.fromHospital.hospitalName
    : transfer.toHospital.hospitalName

  try {
    await notifyHospitalOwner(
      recipientProfileId,
      type,
      {
        transferId: transfer.id,
        unitBagId: transfer.bloodUnit.bagId,
        bloodType: transfer.bloodUnit.bloodType,
        component: transfer.bloodUnit.component,
        otherHospitalName: actorName,
        reason: note,
      },
      {
        relatedEntityType: 'Transfer',
        relatedEntityId: transfer.id,
        dedupeKey: `transfer:${transfer.id}:${type}`,
      }
    )
  } catch (error) {
    console.error('[transfer] notification failed', error)
  }
}

type TransferSide = 'from' | 'to' | 'either'

function buildWhere(
  hospitalProfileId: number,
  filters: ListTransfersQuery
): Prisma.TransferWhereInput {
  const where: Prisma.TransferWhereInput = {}
  const direction = filters.direction ?? 'all'

  if (direction === 'incoming') {
    where.toHospitalProfileId = hospitalProfileId
  } else if (direction === 'outgoing') {
    where.fromHospitalProfileId = hospitalProfileId
  } else {
    where.OR = [
      { fromHospitalProfileId: hospitalProfileId },
      { toHospitalProfileId: hospitalProfileId },
    ]
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.bloodUnitId) {
    where.bloodUnitId = filters.bloodUnitId
  }

  return where
}

async function loadTransferForAction(
  tx: Prisma.TransactionClient,
  hospitalProfileId: number,
  transferId: number,
  side: TransferSide
): Promise<TransferWithRelations> {
  const where: Prisma.TransferWhereInput = { id: transferId }

  if (side === 'from') {
    where.fromHospitalProfileId = hospitalProfileId
  } else if (side === 'to') {
    where.toHospitalProfileId = hospitalProfileId
  } else {
    where.OR = [
      { fromHospitalProfileId: hospitalProfileId },
      { toHospitalProfileId: hospitalProfileId },
    ]
  }

  const transfer = await tx.transfer.findFirst({
    where,
    include: {
      bloodUnit: true,
      fromHospital: transferInclude.fromHospital,
      toHospital: transferInclude.toHospital,
      events: transferInclude.events,
    },
  })

  if (!transfer) {
    throw new AppError('Transfer not found', 404)
  }

  return transfer as TransferWithRelations
}

async function releaseUnitForTransfer(
  tx: Prisma.TransactionClient,
  transfer: TransferWithRelations,
  now: Date
): Promise<void> {
  // A unit still held by an active reservation stays reserved for it.
  if (transfer.reservationId) {
    const reservation = await tx.reservation.findUnique({
      where: { id: transfer.reservationId },
      select: { status: true },
    })

    if (
      reservation &&
      (reservation.status === 'ACTIVE' ||
        reservation.status === 'CONFIRMED')
    ) {
      return
    }
  }

  const targetStatus = resolveTargetUnitStatus(
    transfer.bloodUnit,
    now
  )

  await tx.bloodUnit.updateMany({
    where: { id: transfer.bloodUnitId, status: 'RESERVED' },
    data: { status: targetStatus },
  })
}

interface ActionOptions {
  side: TransferSide
  allowed: TransferStatusValue[]
  next: TransferStatusValue
  note: string
  notifyType: NotificationTypeValue
  guard?: (
    transfer: TransferWithRelations,
    now: Date
  ) => Promise<void> | void
  apply: (
    tx: Prisma.TransactionClient,
    transfer: TransferWithRelations,
    now: Date,
    userId: number
  ) => Prisma.TransferUpdateManyMutationInput
  after?: (
    tx: Prisma.TransactionClient,
    transfer: TransferWithRelations,
    now: Date
  ) => Promise<void>
}

async function runAction(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  options: ActionOptions
): Promise<SerializedTransfer> {
  const now = new Date()

  const transfer = await prisma.$transaction(async (tx) => {
    const existing = await loadTransferForAction(
      tx,
      hospitalProfileId,
      transferId,
      options.side
    )

    if (
      !options.allowed.includes(
        existing.status as TransferStatusValue
      )
    ) {
      throw new AppError(
        `This transfer cannot become ${options.next.toLowerCase()} from its current state (${existing.status.toLowerCase()})`,
        409
      )
    }

    if (options.guard) {
      await options.guard(existing, now)
    }

    const updated = await tx.transfer.updateMany({
      where: {
        id: transferId,
        status: { in: options.allowed },
      },
      data: options.apply(tx, existing, now, userId),
    })

    if (updated.count !== 1) {
      throw new AppError(
        'Transfer state changed, please retry',
        409
      )
    }

    await tx.transferEvent.create({
      data: {
        transferId,
        fromStatus: existing.status,
        toStatus: options.next,
        actorUserId: userId,
        note: options.note,
      },
    })

    if (options.after) {
      await options.after(tx, existing, now)
    }

    return tx.transfer.findUniqueOrThrow({
      where: { id: transferId },
      include: transferInclude,
    })
  })

  const serialized = serializeTransfer(transfer)

  await notifyTransferCounterpart(
    serialized,
    hospitalProfileId,
    options.notifyType,
    options.note
  )

  return serialized
}

export async function listTransfers(
  hospitalProfileId: number,
  filters: ListTransfersQuery
): Promise<SerializedTransfer[]> {
  const now = new Date()

  const transfers = await prisma.transfer.findMany({
    where: buildWhere(hospitalProfileId, filters),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: transferInclude,
  })

  return transfers.map((transfer) =>
    serializeTransfer(transfer, now)
  )
}

export async function findTransfer(
  hospitalProfileId: number,
  transferId: number
): Promise<SerializedTransfer | null> {
  const transfer = await prisma.transfer.findFirst({
    where: {
      id: transferId,
      OR: [
        { fromHospitalProfileId: hospitalProfileId },
        { toHospitalProfileId: hospitalProfileId },
      ],
    },
    include: transferInclude,
  })

  return transfer ? serializeTransfer(transfer) : null
}

export async function listTransferDestinations(
  hospitalProfileId: number
) {
  return prisma.hospitalProfile.findMany({
    where: {
      id: { not: hospitalProfileId },
      status: 'APPROVED',
      isVerified: true,
    },
    select: {
      id: true,
      hospitalName: true,
      address: true,
      phone: true,
    },
    orderBy: { hospitalName: 'asc' },
  })
}

export async function createTransfer(
  fromHospitalProfileId: number,
  userId: number,
  data: CreateTransferInput
): Promise<SerializedTransfer> {
  const now = new Date()

  const transferId = await prisma.$transaction(async (tx) => {
    if (data.toHospitalProfileId === fromHospitalProfileId) {
      throw new AppError(
        'A hospital cannot transfer a unit to itself',
        400
      )
    }

    const destination = await tx.hospitalProfile.findUnique({
      where: { id: data.toHospitalProfileId },
      select: { id: true, status: true, isVerified: true },
    })

    if (!destination) {
      throw new AppError('Destination hospital not found', 404)
    }

    if (
      destination.status !== 'APPROVED' ||
      !destination.isVerified
    ) {
      throw new AppError(
        'The destination hospital is not approved to receive transfers',
        409
      )
    }

    const unit = await tx.bloodUnit.findFirst({
      where: {
        id: data.bloodUnitId,
        hospitalProfileId: fromHospitalProfileId,
      },
    })

    if (!unit) {
      throw new AppError('Blood unit not found', 404)
    }

    let reservationId = data.reservationId ?? null

    if (reservationId) {
      const reservation = await tx.reservation.findFirst({
        where: {
          id: reservationId,
          hospitalProfileId: fromHospitalProfileId,
          bloodUnitId: unit.id,
        },
        select: { id: true, status: true },
      })

      if (!reservation) {
        throw new AppError(
          'Reservation not found for this unit',
          404
        )
      }

      if (
        reservation.status !== 'ACTIVE' &&
        reservation.status !== 'CONFIRMED'
      ) {
        throw new AppError(
          'Only active reservations can be transferred',
          409
        )
      }
    } else if (unit.status === 'RESERVED') {
      const activeReservation = await tx.reservation.findFirst({
        where: {
          bloodUnitId: unit.id,
          status: { in: ['ACTIVE', 'CONFIRMED'] },
        },
        select: { id: true },
      })

      reservationId = activeReservation?.id ?? null
    }

    if (
      !isAvailableStock(
        { ...unit, status: 'AVAILABLE' },
        now
      )
    ) {
      throw new AppError(
        'Only screened, confirmed and unexpired units can be transferred',
        409
      )
    }

    if (unit.status === 'AVAILABLE') {
      const claimed = await tx.bloodUnit.updateMany({
        where: {
          id: unit.id,
          status: 'AVAILABLE',
          screeningStatus: 'PASSED',
          confirmationStatus: 'CONFIRMED',
          expiryDate: { gt: now },
        },
        data: { status: 'RESERVED' },
      })

      if (claimed.count !== 1) {
        throw new AppError(
          'This blood unit is no longer available',
          409
        )
      }
    } else if (unit.status !== 'RESERVED') {
      throw new AppError(
        `A ${unit.status.toLowerCase()} unit cannot be transferred`,
        409
      )
    }

    const created = await tx.transfer.create({
      data: {
        bloodUnitId: unit.id,
        fromHospitalProfileId,
        toHospitalProfileId: data.toHospitalProfileId,
        reservationId,
        status: 'REQUESTED',
        reason: data.reason || null,
        notes: data.notes || null,
        requestedByUserId: userId,
      },
    })

    await tx.transferEvent.create({
      data: {
        transferId: created.id,
        fromStatus: null,
        toStatus: 'REQUESTED',
        actorUserId: userId,
        note: 'Transfer requested',
      },
    })

    return created.id
  })

  const created = await prisma.transfer.findUniqueOrThrow({
    where: { id: transferId },
    include: transferInclude,
  })

  const serialized = serializeTransfer(created)

  await notifyTransferCounterpart(
    serialized,
    fromHospitalProfileId,
    'TRANSFER_REQUESTED',
    data.reason ?? undefined
  )

  return serialized
}

export function approveTransfer(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  note?: string
): Promise<SerializedTransfer> {
  return runAction(hospitalProfileId, userId, transferId, {
    side: 'to',
    allowed: ['REQUESTED'],
    next: 'APPROVED',
    note: note || 'Transfer approved by receiving hospital',
    notifyType: 'TRANSFER_APPROVED',
    guard: (transfer, now) => {
      if (
        !isAvailableStock(
          { ...transfer.bloodUnit, status: 'AVAILABLE' },
          now
        )
      ) {
        throw new AppError(
          'The unit is no longer eligible for transfer',
          409
        )
      }
    },
    apply: (_tx, _transfer, now, actor) => ({
      status: 'APPROVED',
      approvedAt: now,
      approvedByUserId: actor,
    }),
  })
}

export function rejectTransfer(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  reason?: string
): Promise<SerializedTransfer> {
  return runAction(hospitalProfileId, userId, transferId, {
    side: 'to',
    allowed: ['REQUESTED'],
    next: 'REJECTED',
    note: reason || 'Transfer rejected by receiving hospital',
    notifyType: 'TRANSFER_REJECTED',
    apply: (_tx, _transfer, now, actor) => ({
      status: 'REJECTED',
      rejectionReason: reason || null,
      approvedAt: now,
      approvedByUserId: actor,
    }),
    after: (tx, transfer, now) =>
      releaseUnitForTransfer(tx, transfer, now),
  })
}

export function dispatchTransfer(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  note?: string
): Promise<SerializedTransfer> {
  return runAction(hospitalProfileId, userId, transferId, {
    side: 'from',
    allowed: ['APPROVED'],
    next: 'DISPATCHED',
    note: note || 'Unit dispatched by source hospital',
    notifyType: 'TRANSFER_DISPATCHED',
    guard: (transfer, now) => {
      if (
        !isAvailableStock(
          { ...transfer.bloodUnit, status: 'AVAILABLE' },
          now
        )
      ) {
        throw new AppError(
          'The unit expired or became ineligible before dispatch',
          409
        )
      }
    },
    apply: (_tx, _transfer, now, actor) => ({
      status: 'DISPATCHED',
      dispatchedAt: now,
      dispatchedByUserId: actor,
    }),
    after: async (tx, transfer) => {
      await tx.bloodUnit.updateMany({
        where: {
          id: transfer.bloodUnitId,
          status: 'RESERVED',
        },
        data: { status: 'TRANSFERRED' },
      })
    },
  })
}

export function receiveTransfer(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  note?: string
): Promise<SerializedTransfer> {
  return runAction(hospitalProfileId, userId, transferId, {
    side: 'to',
    allowed: ['DISPATCHED'],
    next: 'RECEIVED',
    note: note || 'Unit received by destination hospital',
    notifyType: 'TRANSFER_RECEIVED',
    apply: (_tx, _transfer, now, actor) => ({
      status: 'RECEIVED',
      receivedAt: now,
      receivedByUserId: actor,
    }),
  })
}

export function completeTransfer(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  note?: string
): Promise<SerializedTransfer> {
  return runAction(hospitalProfileId, userId, transferId, {
    side: 'to',
    allowed: ['RECEIVED'],
    next: 'COMPLETED',
    note: note || 'Transfer completed',
    notifyType: 'TRANSFER_COMPLETED',
    apply: (_tx, _transfer, now, actor) => ({
      status: 'COMPLETED',
      completedAt: now,
      completedByUserId: actor,
    }),
    after: async (tx, transfer, now) => {
      const targetStatus = resolveTargetUnitStatus(
        transfer.bloodUnit,
        now
      )

      try {
        const moved = await tx.bloodUnit.updateMany({
          where: {
            id: transfer.bloodUnitId,
            hospitalProfileId: transfer.fromHospitalProfileId,
            status: { in: ['RESERVED', 'TRANSFERRED'] },
          },
          data: {
            hospitalProfileId: transfer.toHospitalProfileId,
            status: targetStatus,
          },
        })

        if (moved.count !== 1) {
          throw new AppError(
            'The transferred unit is no longer available to complete',
            409
          )
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new AppError(
            'The destination hospital already has a unit with this bag ID',
            409
          )
        }

        throw error
      }

      if (transfer.reservationId) {
        await tx.reservation.updateMany({
          where: {
            id: transfer.reservationId,
            status: { in: ['ACTIVE', 'CONFIRMED'] },
          },
          data: { status: 'CONSUMED', consumedAt: now },
        })
      }
    },
  })
}

export function cancelTransfer(
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  note?: string
): Promise<SerializedTransfer> {
  return runAction(hospitalProfileId, userId, transferId, {
    side: 'either',
    allowed: ['REQUESTED', 'APPROVED'],
    next: 'CANCELLED',
    note: note || 'Transfer cancelled',
    notifyType: 'TRANSFER_CANCELLED',
    apply: () => ({ status: 'CANCELLED' }),
    after: (tx, transfer, now) =>
      releaseUnitForTransfer(tx, transfer, now),
  })
}
