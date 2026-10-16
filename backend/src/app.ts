import cors, { type CorsOptions } from 'cors'
import express, { type Express } from 'express'

import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import faydaRoutes from './routes/fayda.routes'

function parseTrustProxy(): boolean | number {
  const raw = process.env.TRUST_PROXY?.trim()

  if (!raw || raw === 'false') {
    return false
  }

  if (raw === 'true') {
    return true
  }

  const hops = Number(raw)

  return Number.isInteger(hops) && hops >= 0 ? hops : false
}

export function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim()

  const configured = raw
    ? raw.split(',')
    : process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : []

  const origins = configured
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (origins.length === 0) {
    // No trusted origin configured: do not negotiate cross-origin access.
    return { origin: false }
  }

  return { origin: origins }
}

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', parseTrustProxy())

  app.use(cors(buildCorsOptions()))
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/fayda', faydaRoutes)

  app.get('/', (_req, res) => {
    res.json({
      message: 'MEKAKEL backend is running',
    })
  })

  return app
}

export const app = createApp()

export default app
