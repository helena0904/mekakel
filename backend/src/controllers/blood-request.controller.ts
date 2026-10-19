import type { Response } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'
import {
  createRequest,
  deleteRequest,
  findRequest,
  listRequests,
  updateRequestStatus,
} from '../services/blood-request.service'
import {
  isHospitalApproved,
  resolveHospitalAccess,
} from '../services/hospital.service'
import type {
  HospitalAccess,
  HospitalStaffRoleValue,
} from '../services/hospital.service'
import {
  createBloodRequestSchema,
  listBloodRequestsQuerySchema,
  updateBloodRequestStatusSchema,
} from '../validators/blood-request.schema'

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

  if (!isHospitalApproved(access)) {
    res.status(403).json({
      message:
        'Hospital approval is required before managing blood requests',
    })
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
        'Your hospital role does not allow managing blood requests',
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

export async function getRequests(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const parsed = listBloodRequestsQuerySchema.safeParse(
    req.query
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid request filters',
    })
  }

  try {
    const requests = await listRequests(
      access.hospitalProfileId,
      parsed.data
    )

    return res.status(200).json({ requests })
  } catch (error) {
    console.error('List blood requests error:', error)

    return res.status(500).json({
      message: 'Unable to load blood requests',
    })
  }
}

export async function getRequest(
  req: AuthRequest,
  res: Response
) {
  const access = await ensureHospital(req, res)

  if (!access) {
    return
  }

  const requestId = parseId(req.params.id)

  if (requestId === null) {
    return res.status(400).json({
      message: 'Invalid blood request id',
    })
  }

  try {
    const request = await findRequest(
      access.hospitalProfileId,
      requestId
    )

    if (!request) {
      return res.status(404).json({
        message: 'Blood request not found',
      })
    }

    return res.status(200).json({ request })
  } catch (error) {
    console.error('Get blood request error:', error)

    return res.status(500).json({
      message: 'Unable to load blood request',
    })
  }
}

export async function postRequest(
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

  const parsed = createBloodRequestSchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid blood request information',
      errors: parsed.error.issues,
    })
  }

  try {
    const request = await createRequest(
      access.hospitalProfileId,
      req.user!.userId,
      parsed.data
    )

    return res.status(201).json({
      message: 'Blood request created',
      request,
    })
  } catch (error) {
    console.error('Create blood request error:', error)

    return res.status(500).json({
      message: 'Unable to create blood request',
    })
  }
}

export async function patchRequestStatus(
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

  const requestId = parseId(req.params.id)

  if (requestId === null) {
    return res.status(400).json({
      message: 'Invalid blood request id',
    })
  }

  const parsed = updateBloodRequestStatusSchema.safeParse(
    req.body
  )

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid request status',
    })
  }

  try {
    const existing = await findRequest(
      access.hospitalProfileId,
      requestId
    )

    if (!existing) {
      return res.status(404).json({
        message: 'Blood request not found',
      })
    }

    const request = await updateRequestStatus(
      requestId,
      parsed.data.status
    )

    return res.status(200).json({
      message: 'Blood request updated',
      request,
    })
  } catch (error) {
    console.error('Update blood request error:', error)

    return res.status(500).json({
      message: 'Unable to update blood request',
    })
  }
}

export async function removeRequest(
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

  const requestId = parseId(req.params.id)

  if (requestId === null) {
    return res.status(400).json({
      message: 'Invalid blood request id',
    })
  }

  try {
    const existing = await findRequest(
      access.hospitalProfileId,
      requestId
    )

    if (!existing) {
      return res.status(404).json({
        message: 'Blood request not found',
      })
    }

    await deleteRequest(requestId)

    return res.status(200).json({
      message: 'Blood request removed',
    })
  } catch (error) {
    console.error('Delete blood request error:', error)

    return res.status(500).json({
      message: 'Unable to remove blood request',
    })
  }
}
