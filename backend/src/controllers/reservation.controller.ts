import type { Response } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'
import { AppError, isAppError } from '../lib/errors'
import {
  actorFromRequest,
  recordAuditSafely,
  type AuditActionValue,
} from '../services/audit.service'
import { resolveHospitalAccess } from '../services/hospital.service'
import type {
  HospitalAccess,
  HospitalStaffRoleValue,
} from '../services/hospital.service'
import {
  cancelReservation,
  confirmReservation,
  consumeReservation,
  createReservation,
  findReservation,
  listReservations,
  recordDonorResponse,
  releaseReservation,
} from '../services/reservation.service'
import {
  createReservationSchema,
  donorResponseSchema,
  listReservationsQuerySchema,
  reservationActionSchema,
} from '../validators/reservation.schema'

const CAN_WRITE: HospitalStaffRoleValue[] = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'TECHNICIAN',
]

async function ensureHospital(
  req: AuthRequest,
  res: Response
): Promise<HospitalAccess | null> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' })
    return null
  }

  const access = await resolveHospitalAccess(req.user.userId)

  if (!access) {
    res.status(403).json({ message: 'Hospital access required' })
    return null
  }

  return access
}

function ensureWrite(
  res: Response,
  access: HospitalAccess
): boolean {
  if (!CAN_WRITE.includes(access.role)) {
    res.status(403).json({
      message:
        'Your hospital role does not allow managing reservations',
    })
    return false
  }

  return true
}

function parseId(value: unknown): number | null {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

function respondError(res: Response, error: unknown, fallback: string) {
  if (isAppError(error) || error instanceof AppError) {
    return res
      .status((error as AppError).statusCode)
      .json({ message: error.message })
  }

  console.error(fallback, error)

  return res.status(500).json({ message: fallback })
}

function auditReservation(
  req: AuthRequest,
  action: AuditActionValue,
  reservation: unknown,
  summary: string
) {
  void recordAuditSafely({
    ...actorFromRequest(req),
    action,
    entityType: 'Reservation',
    entityId:
      (reservation as { id?: number } | null)?.id ?? null,
    summary,
  })
}

export async function getReservations(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const parsed = listReservationsQuerySchema.safeParse(
    req.query
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid reservation filters',
    })
  }

  try {
    const reservations = await listReservations(
      access.hospitalProfileId,
      parsed.data
    )

    return res.status(200).json({ reservations })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to load reservations'
    )
  }
}

export async function getReservation(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const reservationId = parseId(req.params.id)

  if (reservationId === null) {
    return res.status(400).json({
      message: 'Invalid reservation id',
    })
  }

  try {
    const reservation = await findReservation(
      access.hospitalProfileId,
      reservationId
    )

    if (!reservation) {
      return res.status(404).json({
        message: 'Reservation not found',
      })
    }

    return res.status(200).json({ reservation })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to load the reservation'
    )
  }
}

export async function postReservation(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureWrite(res, access)) {
    return
  }

  const parsed = createReservationSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid reservation information',
      errors: parsed.error.issues,
    })
  }

  try {
    const reservation = await createReservation(
      access.hospitalProfileId,
      req.user!.userId,
      parsed.data
    )

    auditReservation(
      req,
      'RESERVATION_CREATED',
      reservation,
      'Blood unit reserved'
    )

    return res.status(201).json({
      message: 'Blood unit reserved',
      reservation,
    })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to reserve the blood unit'
    )
  }
}

export async function postConfirmReservation(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureWrite(res, access)) {
    return
  }

  const reservationId = parseId(req.params.id)

  if (reservationId === null) {
    return res.status(400).json({
      message: 'Invalid reservation id',
    })
  }

  try {
    const reservation = await confirmReservation(
      access.hospitalProfileId,
      reservationId
    )

    auditReservation(
      req,
      'RESERVATION_CONFIRMED',
      reservation,
      'Reservation confirmed'
    )

    return res.status(200).json({
      message: 'Reservation confirmed',
      reservation,
    })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to confirm the reservation'
    )
  }
}

async function handleTerminalAction(
  req: AuthRequest,
  res: Response,
  action: (
    hospitalProfileId: number,
    reservationId: number,
    reason?: string
  ) => Promise<unknown>,
  successMessage: string,
  fallbackMessage: string,
  auditAction: AuditActionValue
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureWrite(res, access)) {
    return
  }

  const reservationId = parseId(req.params.id)

  if (reservationId === null) {
    return res.status(400).json({
      message: 'Invalid reservation id',
    })
  }

  const parsed = reservationActionSchema.safeParse(
    req.body ?? {}
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid reservation action',
    })
  }

  try {
    const reservation = await action(
      access.hospitalProfileId,
      reservationId,
      parsed.data.reason
    )

    auditReservation(
      req,
      auditAction,
      reservation,
      successMessage
    )

    return res
      .status(200)
      .json({ message: successMessage, reservation })
  } catch (error) {
    return respondError(res, error, fallbackMessage)
  }
}

export function postCancelReservation(
  req: AuthRequest,
  res: Response
) {
  return handleTerminalAction(
    req,
    res,
    cancelReservation,
    'Reservation cancelled',
    'Unable to cancel the reservation',
    'RESERVATION_CANCELLED'
  )
}

export function postReleaseReservation(
  req: AuthRequest,
  res: Response
) {
  return handleTerminalAction(
    req,
    res,
    releaseReservation,
    'Reservation released',
    'Unable to release the reservation',
    'RESERVATION_RELEASED'
  )
}

export async function postConsumeReservation(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureWrite(res, access)) {
    return
  }

  const reservationId = parseId(req.params.id)

  if (reservationId === null) {
    return res.status(400).json({
      message: 'Invalid reservation id',
    })
  }

  try {
    const reservation = await consumeReservation(
      access.hospitalProfileId,
      reservationId
    )

    auditReservation(
      req,
      'RESERVATION_CONSUMED',
      reservation,
      'Reserved unit marked as used'
    )

    return res.status(200).json({
      message: 'Reserved unit marked as used',
      reservation,
    })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to mark the reserved unit as used'
    )
  }
}

export async function patchDonorResponse(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  if (!ensureWrite(res, access)) {
    return
  }

  const reservationId = parseId(req.params.id)

  if (reservationId === null) {
    return res.status(400).json({
      message: 'Invalid reservation id',
    })
  }

  const parsed = donorResponseSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid donor response',
      errors: parsed.error.issues,
    })
  }

  try {
    const reservation = await recordDonorResponse(
      access.hospitalProfileId,
      reservationId,
      parsed.data
    )

    return res.status(200).json({
      message: 'Donor response recorded',
      reservation,
    })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to record the donor response'
    )
  }
}
