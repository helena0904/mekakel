import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

import { createApp } from './helpers/app'
import { prisma, resetDatabase, disconnectDatabase } from './helpers/db'
import { createUser } from './helpers/factories'

const app = createApp()

interface Claims {
  userId: number
  role: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
  passwordVersion: number
}

function signToken(
  claims: Claims,
  expiresIn: string | number = '1h'
): string {
  return jwt.sign(claims, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
    expiresIn,
    jwtid: randomUUID(),
  })
}

function getMe(token?: string) {
  const req = request(app).get('/api/users/me')
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('GET /api/users/me (authenticateToken)', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await getMe()
    expect(res.status).toBe(401)
  })

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Token abc.def.ghi')

    expect(res.status).toBe(401)
  })

  it('accepts a valid donor token and returns the user', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const token = signToken({
      userId: user.id,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    const res = await getMe(token)

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      accountType: 'INDIVIDUAL',
      role: 'DONOR',
    })
  })

  it('rejects an expired token', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const token = signToken(
      {
        userId: user.id,
        role: 'DONOR',
        accountType: 'INDIVIDUAL',
        passwordVersion: 0,
      },
      '-1s'
    )

    const res = await getMe(token)
    expect(res.status).toBe(401)
  })

  it('rejects a token with a tampered signature', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    const token = signToken({
      userId: user.id,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    const tampered =
      token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')

    const res = await getMe(tampered)
    expect(res.status).toBe(401)
  })

  it('rejects a token whose user no longer exists', async () => {
    const token = signToken({
      userId: 999999,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    const res = await getMe(token)
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/no longer exists/i)
  })

  it('rejects a token when the password version has changed', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      passwordVersion: 2,
    })

    const token = signToken({
      userId: user.id,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    const res = await getMe(token)
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/session is no longer valid/i)
  })

  it('rejects a token when the account role has changed', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    const token = signToken({
      userId: user.id,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })

    const res = await getMe(token)
    expect(res.status).toBe(401)
  })

  it('rejects a token for an inactive account with 403', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      isActive: false,
    })
    const token = signToken({
      userId: user.id,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    const res = await getMe(token)
    expect(res.status).toBe(403)
  })

  it('rejects a hospital token while the hospital is unverified', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })
    const token = signToken({
      userId: user.id,
      role: 'HOSPITAL_STAFF',
      accountType: 'HOSPITAL',
      passwordVersion: 0,
    })

    const res = await getMe(token)
    expect(res.status).toBe(403)
  })

  it('accepts a verified hospital token', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: true,
    })
    const token = signToken({
      userId: user.id,
      role: 'HOSPITAL_STAFF',
      accountType: 'HOSPITAL',
      passwordVersion: 0,
    })

    const res = await getMe(token)
    expect(res.status).toBe(200)
    expect(res.body.user.accountType).toBe('HOSPITAL')
  })
})
