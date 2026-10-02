import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    userId: number
    role: string
    accountType: string
  }
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization

  if (!authorization) {
    return res.status(401).json({
      message: 'Authentication required',
    })
  }

  const token = authorization.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required',
    })
  }

  const secret = process.env.JWT_SECRET

  if (!secret) {
    return res.status(500).json({
      message: 'JWT secret is not configured',
    })
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: number
      role: string
      accountType: string
    }

    req.user = decoded

    next()
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired token',
    })
  }
}