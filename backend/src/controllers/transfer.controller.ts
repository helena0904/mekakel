import type { Response } from 'express'
import type { ZodTypeAny } from 'zod'

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
  approveTransfer,
  cancelTransfer,
  completeTransfer,
  createTransfer,
  dispatchTransfer,
  findTransfer,
  listTransferDestinations,
  listTransfers,
  receiveTransfer,
  rejectTransfer,
} from '../services/transfer.service'
import type { SerializedTransfer } from '../services/transfer.service'
import {
  createTransferSchema,
  listTransfersQuerySchema,
  rejectTransferSchema,
  transferActionSchema,
} from '../validators/transfer.schema'

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
        'Your hospital role does not allow managing transfers',
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

function auditTransfer(
  req: AuthRequest,
  action: AuditActionValue,
  transfer: unknown,
  summary: string
) {
  void recordAuditSafely({
    ...actorFromRequest(req),
    action,
    entityType: 'Transfer',
    entityId:
      (transfer as { id?: number } | null)?.id ?? null,
    summary,
  })
}

export async function getTransfers(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const parsed = listTransfersQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid transfer filters',
    })
  }

  try {
    const transfers = await listTransfers(
      access.hospitalProfileId,
      parsed.data
    )

    return res.status(200).json({ transfers })
  } catch (error) {
    return respondError(res, error, 'Unable to load transfers')
  }
}

export async function getTransferDestinations(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  try {
    const hospitals = await listTransferDestinations(
      access.hospitalProfileId
    )

    return res.status(200).json({ hospitals })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to load destination hospitals'
    )
  }
}

export async function getTransfer(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const transferId = parseId(req.params.id)

  if (transferId === null) {
    return res.status(400).json({
      message: 'Invalid transfer id',
    })
  }

  try {
    const transfer = await findTransfer(
      access.hospitalProfileId,
      transferId
    )

    if (!transfer) {
      return res.status(404).json({
        message: 'Transfer not found',
      })
    }

    return res.status(200).json({ transfer })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to load the transfer'
    )
  }
}

export async function postTransfer(
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

  const parsed = createTransferSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid transfer information',
      errors: parsed.error.issues,
    })
  }

  try {
    const transfer = await createTransfer(
      access.hospitalProfileId,
      req.user!.userId,
      parsed.data
    )

    auditTransfer(
      req,
      'TRANSFER_REQUESTED',
      transfer,
      'Transfer requested'
    )

    return res.status(201).json({
      message: 'Transfer requested',
      transfer,
    })
  } catch (error) {
    return respondError(
      res,
      error,
      'Unable to request the transfer'
    )
  }
}

type TransferAction = (
  hospitalProfileId: number,
  userId: number,
  transferId: number,
  argument?: string
) => Promise<SerializedTransfer>

function handleTransferAction(
  schema: ZodTypeAny,
  extract: (body: unknown) => string | undefined,
  action: TransferAction,
  successMessage: string,
  fallbackMessage: string,
  auditAction: AuditActionValue
) {
  return async function handler(
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

    const transferId = parseId(req.params.id)

    if (transferId === null) {
      return res.status(400).json({
        message: 'Invalid transfer id',
      })
    }

    const parsed = schema.safeParse(req.body ?? {})

    if (!parsed.success) {
      return res.status(400).json({
        message:
          parsed.error.issues[0]?.message ??
          'Invalid transfer action',
      })
    }

    try {
      const transfer = await action(
        access.hospitalProfileId,
        req.user!.userId,
        transferId,
        extract(parsed.data)
      )

      auditTransfer(
        req,
        auditAction,
        transfer,
        successMessage
      )

      return res
        .status(200)
        .json({ message: successMessage, transfer })
    } catch (error) {
      return respondError(res, error, fallbackMessage)
    }
  }
}

const noteFromBody = (body: unknown) =>
  (body as { note?: string }).note

const reasonFromBody = (body: unknown) =>
  (body as { reason?: string }).reason

export const postApproveTransfer = handleTransferAction(
  transferActionSchema,
  noteFromBody,
  approveTransfer,
  'Transfer approved',
  'Unable to approve the transfer',
  'TRANSFER_APPROVED'
)

export const postRejectTransfer = handleTransferAction(
  rejectTransferSchema,
  reasonFromBody,
  rejectTransfer,
  'Transfer rejected',
  'Unable to reject the transfer',
  'TRANSFER_REJECTED'
)

export const postDispatchTransfer = handleTransferAction(
  transferActionSchema,
  noteFromBody,
  dispatchTransfer,
  'Transfer dispatched',
  'Unable to dispatch the transfer',
  'TRANSFER_DISPATCHED'
)

export const postReceiveTransfer = handleTransferAction(
  transferActionSchema,
  noteFromBody,
  receiveTransfer,
  'Transfer received',
  'Unable to mark the transfer as received',
  'TRANSFER_RECEIVED'
)

export const postCompleteTransfer = handleTransferAction(
  transferActionSchema,
  noteFromBody,
  completeTransfer,
  'Transfer completed',
  'Unable to complete the transfer',
  'TRANSFER_COMPLETED'
)

export const postCancelTransfer = handleTransferAction(
  transferActionSchema,
  noteFromBody,
  cancelTransfer,
  'Transfer cancelled',
  'Unable to cancel the transfer',
  'TRANSFER_CANCELLED'
)
