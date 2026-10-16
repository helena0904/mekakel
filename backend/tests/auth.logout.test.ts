import request from 'supertest'
import jwt from 'jsonwebtoken'

import { createApp } from './helpers/app'
import { prisma, resetDatabase, disconnectDatabase } from './helpers/db'
import { createUser, uniqueIp, TEST_PASSWORD } from './helpers/factories'

const app = createApp()

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

async function loginAndGetToken() {
  const { user } = await createUser({ accountType: 'INDIVIDUAL' })

  const res = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send({
      email: user.email,
      password: TEST_PASSWORD,
      accountType: 'INDIVIDUAL',
    })

  expect(res.status).toBe(200)
  return { user, token: res.body.token as string }
}

describe('POST /api/auth/logout', () => {
  it('revokes the presented token so it can no longer be used', async () => {
    const { token } = await loginAndGetToken()

    const before = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
    expect(logout.status).toBe(200)

    const after = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(401)
    expect(after.body.message).toMatch(/logged out/i)

    const decoded = jwt.decode(token) as jwt.JwtPayload
    const record = await prisma.revokedToken.findUnique({
      where: { jti: decoded.jti! },
    })
    expect(record).not.toBeNull()
  })

  it('rejects logout without a token', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(401)
  })

  it('rejects logout with an already-revoked token', async () => {
    const { token } = await loginAndGetToken()

    expect(
      (
        await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`)
      ).status
    ).toBe(200)

    const second = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
    expect(second.status).toBe(401)
  })

  it('does not affect other active sessions', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    async function login() {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', uniqueIp())
        .send({
          email: user.email,
          password: TEST_PASSWORD,
          accountType: 'INDIVIDUAL',
        })
      expect(res.status).toBe(200)
      return res.body.token as string
    }

    const first = await login()
    const second = await login()

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${first}`)

    expect(
      (
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${first}`)
      ).status
    ).toBe(401)

    expect(
      (
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${second}`)
      ).status
    ).toBe(200)
  })
})
