import type {
  Response,
  NextFunction,
} from 'express'

import type { AuthRequest } from './auth.middleware'

export type UserRoleValue =
  | 'DONOR'
  | 'HOSPITAL_STAFF'
  | 'DOCTOR'
  | 'ADMIN'
  | 'USER'

export function requireRole(...roles: UserRoleValue[]) {
  return function authorizeRole(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
      })
    }

    if (!roles.includes(req.user.role as UserRoleValue)) {
      return res.status(403).json({
        message:
          'You do not have permission to perform this action',
      })
    }

    return next()
  }
}

export const requireAdmin = requireRole('ADMIN')

export const requireDoctor = requireRole('DOCTOR')
