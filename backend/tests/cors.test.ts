import request from 'supertest'

import { createApp, buildCorsOptions } from '../src/app'

const app = createApp()

const allowedOrigin = process.env.CORS_ORIGINS!.split(',')[0].trim()

describe('CORS configuration', () => {
  it('reflects the configured origin', async () => {
    const res = await request(app).get('/').set('Origin', allowedOrigin)

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin)
  })

  it('does not allow an unconfigured origin', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'http://evil.example')

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('defaults to denying cross-origin access when nothing is configured', () => {
    const previous = process.env.CORS_ORIGINS
    const previousFrontend = process.env.FRONTEND_URL

    delete process.env.CORS_ORIGINS
    delete process.env.FRONTEND_URL

    try {
      expect(buildCorsOptions()).toEqual({ origin: false })
    } finally {
      process.env.CORS_ORIGINS = previous
      process.env.FRONTEND_URL = previousFrontend
    }
  })
})
