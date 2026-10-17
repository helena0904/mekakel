import type {
  Request,
  Response,
  NextFunction,
} from 'express'

import jwt, {
  type JwtPayload,
} from 'jsonwebtoken'

import prisma from '../lib/prisma'

type AccountType = 'INDIVIDUAL' | 'HOSPITAL'

interface AuthTokenClaims {
  userId: number
  role: string
  accountType: AccountType
  passwordVersion: number
  jti: string
  exp: number
}

export interface AuthRequest extends Request {
  user?: {
    userId: number
    name: string
    role: string
    accountType: AccountType
    jti: string
    exp: number
  }
}

function isAuthTokenClaims(
  value: unknown,
): value is AuthTokenClaims {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const claims = value as Record<string, unknown>

  return (
    typeof claims.userId === 'number' &&
    Number.isSafeInteger(claims.userId) &&
    claims.userId > 0 &&
    typeof claims.role === 'string' &&
    (
      claims.accountType === 'INDIVIDUAL' ||
      claims.accountType === 'HOSPITAL'
    ) &&
    typeof claims.passwordVersion === 'number' &&
    Number.isSafeInteger(claims.passwordVersion) &&
    claims.passwordVersion >= 0 &&
    typeof claims.jti === 'string' &&
    claims.jti.length > 0 &&
    typeof claims.exp === 'number' &&
    Number.isSafeInteger(claims.exp)
  )
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization

  const match = authorization
    ?.trim()
    .match(/^Bearer\s+(\S+)$/i)

  if (!match) {
    return res.status(401).json({
      message: 'Authentication required',
    })
  }

  const token = match[1]
  const secret = process.env.JWT_SECRET

  if (!secret) {
    console.error('JWT_SECRET is not configured')

    return res.status(500).json({
      message: 'Server authentication is not configured',
    })
  }

  let decoded: string | JwtPayload

  try {
    decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    })
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired authentication token',
    })
  }

  if (!isAuthTokenClaims(decoded)) {
    return res.status(401).json({
      message: 'Invalid authentication token',
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        name: true,
        role: true,
        accountType: true,
        isActive: true,
        passwordVersion: true,
      },
    })

    if (!user) {
      return res.status(401).json({
        message: 'Account no longer exists',
      })
    }

    if (user.passwordVersion !== decoded.passwordVersion) {
      return res.status(401).json({
        message:
          'Your session is no longer valid. Please log in again.',
      })
    }

    if (
      user.role !== decoded.role ||
      user.accountType !== decoded.accountType
    ) {
      return res.status(401).json({
        message:
          'Your account permissions have changed. Please log in again.',
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is inactive',
      })
    }

    // Unapproved hospitals may still sign in to view their dashboard, which
    // shows an "approval required" state. Management actions are gated by
    // role checks in the hospital/inventory controllers.

    const revoked = await prisma.revokedToken.findUnique({
      where: { jti: decoded.jti },
      select: { id: true },
    })

    if (revoked) {
      return res.status(401).json({
        message:
          'This session has been logged out. Please log in again.',
      })
    }

    req.user = {
      userId: user.id,
      name: user.name,
      role: user.role,
      accountType: user.accountType,
      jti: decoded.jti,
      exp: decoded.exp,
    }

    return next()
  } catch (error) {
    console.error(
      'Authentication middleware error:',
      error,
    )

    return res.status(500).json({
      message: 'Unable to verify authentication',
    })
  }
}