import type { Response } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'
import {
  listHospitals,
  notifyHospitalReview,
  reviewHospital,
} from '../services/hospital.service'
import { reviewHospitalSchema } from '../validators/hospital.schema'
import {
  findUser,
  listUsers,
  updateUser,
} from '../services/admin.service'
import {
  actorFromRequest,
  listAuditLogs,
} from '../services/audit.service'
import {
  getAllSettings,
  updateSettings,
} from '../services/settings.service'
import {
  listAuditLogsQuerySchema,
  listUsersQuerySchema,
  updateSettingsSchema,
  updateUserSchema,
} from '../validators/admin.schema'

function parseId(value: unknown): number | null {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export async function getUsers(
  req: AuthRequest,
  res: Response
) {
  const parsed = listUsersQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid user filters',
    })
  }

  try {
    const users = await listUsers(parsed.data)

    return res.status(200).json({ users })
  } catch (error) {
    console.error('List users error:', error)

    return res.status(500).json({
      message: 'Unable to load users',
    })
  }
}

export async function patchUser(
  req: AuthRequest,
  res: Response
) {
  const userId = parseId(req.params.id)

  if (userId === null) {
    return res.status(400).json({
      message: 'Invalid user id',
    })
  }

  const parsed = updateUserSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid user update',
    })
  }

  try {
    const existing = await findUser(userId)

    if (!existing) {
      return res.status(404).json({
        message: 'User not found',
      })
    }

    if (userId === req.user?.userId && parsed.data.isActive === false) {
      return res.status(400).json({
        message: 'You cannot deactivate your own account',
      })
    }

    const user = await updateUser(
      userId,
      parsed.data,
      actorFromRequest(req)
    )

    return res.status(200).json({
      message: 'User updated',
      user,
    })
  } catch (error) {
    console.error('Update user error:', error)

    return res.status(500).json({
      message: 'Unable to update the user',
    })
  }
}

export async function getHospitalApprovals(
  _req: AuthRequest,
  res: Response
) {
  try {
    const hospitals = await listHospitals()

    return res.status(200).json({ hospitals })
  } catch (error) {
    console.error('List hospital approvals error:', error)

    return res.status(500).json({
      message: 'Unable to load hospital registrations',
    })
  }
}

export async function reviewHospitalRegistration(
  req: AuthRequest,
  res: Response
) {
  const hospitalId = parseId(req.params.id)

  if (hospitalId === null) {
    return res.status(400).json({
      message: 'Invalid hospital id',
    })
  }

  const parsed = reviewHospitalSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid review information',
    })
  }

  if (
    (parsed.data.decision === 'REJECT' ||
      parsed.data.decision === 'SUSPEND') &&
    !parsed.data.notes
  ) {
    return res.status(400).json({
      message:
        'A reason is required to reject or suspend a hospital',
    })
  }

  try {
    const hospital = await reviewHospital(
      hospitalId,
      parsed.data,
      actorFromRequest(req)
    )

    if (!hospital) {
      return res.status(404).json({
        message: 'Hospital not found',
      })
    }

    try {
      await notifyHospitalReview(
        hospital,
        parsed.data.decision,
        parsed.data.notes
      )
    } catch (notificationError) {
      console.error(
        '[admin] hospital review notification failed',
        notificationError
      )
    }

    return res.status(200).json({
      message: 'Hospital registration updated',
      hospital,
    })
  } catch (error) {
    console.error('Review hospital registration error:', error)

    return res.status(500).json({
      message: 'Unable to update hospital registration',
    })
  }
}

export async function getAuditLogs(
  req: AuthRequest,
  res: Response
) {
  const parsed = listAuditLogsQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid audit log filters',
    })
  }

  try {
    const logs = await listAuditLogs(parsed.data)

    return res.status(200).json({ logs })
  } catch (error) {
    console.error('List audit logs error:', error)

    return res.status(500).json({
      message: 'Unable to load audit logs',
    })
  }
}

export async function getSettings(
  _req: AuthRequest,
  res: Response
) {
  try {
    const settings = await getAllSettings()

    return res.status(200).json({ settings })
  } catch (error) {
    console.error('Get settings error:', error)

    return res.status(500).json({
      message: 'Unable to load settings',
    })
  }
}

export async function putSettings(
  req: AuthRequest,
  res: Response
) {
  const parsed = updateSettingsSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message:
        parsed.error.issues[0]?.message ??
        'Invalid settings update',
    })
  }

  try {
    const settings = await updateSettings(
      parsed.data,
      actorFromRequest(req)
    )

    return res.status(200).json({
      message: 'Settings updated',
      settings,
    })
  } catch (error) {
    console.error('Update settings error:', error)

    return res.status(500).json({
      message: 'Unable to update settings',
    })
  }
}
