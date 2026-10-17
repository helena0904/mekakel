import type { Response } from 'express'
import { Prisma } from '@prisma/client'

import type { AuthRequest } from '../middleware/auth.middleware'
import {
  createUnit,
  deleteUnit,
  findUnit,
  getExpiryAlerts,
  getSummary,
  listUnits,
  serializeUnit,
  updateUnit,
} from '../services/inventory.service'
import { resolveHospitalAccess } from '../services/hospital.service'
import type {
  HospitalAccess,
  HospitalStaffRoleValue,
} from '../services/hospital.service'
import {
  actorFromRequest,
  recordAuditSafely,
  type AuditActionValue,
} from '../services/audit.service'
import {
  createBloodUnitSchema,
  listBloodUnitsQuerySchema,
  updateBloodUnitSchema,
} from '../validators/inventory.schema'

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
        'Your hospital role does not allow modifying inventory',
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

function auditInventory(
  req: AuthRequest,
  action: AuditActionValue,
  unitId: number | null,
  summary: string
) {
  void recordAuditSafely({
    ...actorFromRequest(req),
    action,
    entityType: 'BloodUnit',
    entityId: unitId,
    summary,
  })
}

export async function getUnits(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const parsed = listBloodUnitsQuerySchema.safeParse(
    req.query
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid inventory filters',
    })
  }

  try {
    const units = await listUnits(
      access.hospitalProfileId,
      parsed.data
    )

    return res.status(200).json({ units })
  } catch (error) {
    console.error('List blood units error:', error)

    return res.status(500).json({
      message: 'Unable to load blood inventory',
    })
  }
}

export async function getUnit(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const unitId = parseId(req.params.id)

  if (unitId === null) {
    return res.status(400).json({
      message: 'Invalid blood unit id',
    })
  }

  try {
    const unit = await findUnit(
      access.hospitalProfileId,
      unitId
    )

    if (!unit) {
      return res.status(404).json({
        message: 'Blood unit not found',
      })
    }

    return res.status(200).json({
      unit: serializeUnit(unit),
    })
  } catch (error) {
    console.error('Get blood unit error:', error)

    return res.status(500).json({
      message: 'Unable to load blood unit',
    })
  }
}

export async function postUnit(
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

  const parsed = createBloodUnitSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid blood unit information',
      errors: parsed.error.issues,
    })
  }

  try {
    const unit = await createUnit(
      access.hospitalProfileId,
      req.user!.userId,
      parsed.data
    )

    auditInventory(
      req,
      'INVENTORY_UNIT_CREATED',
      unit.id,
      `Blood unit ${unit.bagId} added`
    )

    return res.status(201).json({
      message: 'Blood unit added',
      unit: serializeUnit(unit),
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return res.status(409).json({
        message:
          'A blood unit with this bag ID already exists',
      })
    }

    console.error('Create blood unit error:', error)

    return res.status(500).json({
      message: 'Unable to add blood unit',
    })
  }
}

export async function putUnit(
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

  const unitId = parseId(req.params.id)

  if (unitId === null) {
    return res.status(400).json({
      message: 'Invalid blood unit id',
    })
  }

  const parsed = updateBloodUnitSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid blood unit information',
      errors: parsed.error.issues,
    })
  }

  try {
    const existing = await findUnit(
      access.hospitalProfileId,
      unitId
    )

    if (!existing) {
      return res.status(404).json({
        message: 'Blood unit not found',
      })
    }

    const collectionDate = parsed.data.collectionDate
      ? new Date(parsed.data.collectionDate)
      : existing.collectionDate

    const expiryDate = parsed.data.expiryDate
      ? new Date(parsed.data.expiryDate)
      : existing.expiryDate

    if (expiryDate <= collectionDate) {
      return res.status(400).json({
        message:
          'Expiry date must be after collection date',
      })
    }

    const unit = await updateUnit(unitId, parsed.data)

    auditInventory(
      req,
      'INVENTORY_UNIT_UPDATED',
      unit.id,
      `Blood unit ${unit.bagId} updated`
    )

    return res.status(200).json({
      message: 'Blood unit updated',
      unit: serializeUnit(unit),
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return res.status(409).json({
        message:
          'A blood unit with this bag ID already exists',
      })
    }

    console.error('Update blood unit error:', error)

    return res.status(500).json({
      message: 'Unable to update blood unit',
    })
  }
}

export async function removeUnit(
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

  const unitId = parseId(req.params.id)

  if (unitId === null) {
    return res.status(400).json({
      message: 'Invalid blood unit id',
    })
  }

  try {
    const existing = await findUnit(
      access.hospitalProfileId,
      unitId
    )

    if (!existing) {
      return res.status(404).json({
        message: 'Blood unit not found',
      })
    }

    await deleteUnit(unitId)

    auditInventory(
      req,
      'INVENTORY_UNIT_DELETED',
      unitId,
      `Blood unit ${existing.bagId} removed`
    )

    return res.status(200).json({
      message: 'Blood unit removed',
    })
  } catch (error) {
    console.error('Delete blood unit error:', error)

    return res.status(500).json({
      message: 'Unable to remove blood unit',
    })
  }
}

export async function getStockSummary(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  try {
    const summary = await getSummary(
      access.hospitalProfileId
    )

    return res.status(200).json({ summary })
  } catch (error) {
    console.error('Get stock summary error:', error)

    return res.status(500).json({
      message: 'Unable to load stock summary',
    })
  }
}

export async function getExpiryAlertsHandler(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const withinDays = req.query.withinDays
    ? Number(req.query.withinDays)
    : 7

  if (
    !Number.isInteger(withinDays) ||
    withinDays < 0 ||
    withinDays > 365
  ) {
    return res.status(400).json({
      message: 'Invalid expiry window',
    })
  }

  try {
    const alerts = await getExpiryAlerts(
      access.hospitalProfileId,
      withinDays
    )

    return res.status(200).json({ alerts, withinDays })
  } catch (error) {
    console.error('Get expiry alerts error:', error)

    return res.status(500).json({
      message: 'Unable to load expiry alerts',
    })
  }
}
