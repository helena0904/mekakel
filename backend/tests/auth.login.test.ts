import request from 'supertest'
import jwt from 'jsonwebtoken'

import { createApp } from './helpers/app'
import { resetDatabase, disconnectDatabase } from './helpers/db'
import {
  createUser,
  uniqueEmail,
  uniqueIp,
  TEST_PASSWORD,
} from './helpers/factories'

const app = createApp()

function login(body: Record<string, unknown>, ip = uniqueIp()) {
  return request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send(body)
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('POST /api/auth/login', () => {
  it('logs in an individual donor and returns a valid token', async () => {
    const { user } = await createUser({
      email: uniqueEmail('donor'),
      accountType: 'INDIVIDUAL',
    })

    const res = await login({
      email: user.email,
      password: TEST_PASSWORD,
      accountType: 'INDIVIDUAL',
    })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/successful/i)
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
    })

    const decoded = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET!
    ) as jwt.JwtPayload

    expect(decoded).toMatchObject({
      userId: user.id,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })
  })

  it('logs in a verified hospital account', async () => {
    const { user } = await createUser({
      email: uniqueEmail('hospital'),
      accountType: 'HOSPITAL',
      hospitalVerified: true,
    })

    const res = await login({
      email: user.email,
      password: TEST_PASSWORD,
      accountType: 'HOSPITAL',
    })

    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('HOSPITAL_STAFF')
  })

  it('blocks an unverified hospital with 403', async () => {
    const { user } = await createUser({
      email: uniqueEmail('hospital'),
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })

    const res = await login({
      email: user.email,
      password: TEST_PASSWORD,
      accountType: 'HOSPITAL',
    })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/pending administrator verification/i)
  })

  it('rejects an incorrect password with 401', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const res = await login({
      email: user.email,
      password: 'WrongPassword1!',
      accountType: 'INDIVIDUAL',
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid email or password/i)
  })

  it('rejects an unknown email with 401', async () => {
    const res = await login({
      email: uniqueEmail('nobody'),
      password: TEST_PASSWORD,
      accountType: 'INDIVIDUAL',
    })

    expect(res.status).toBe(401)
  })

  it('rejects a mismatched account type with 401', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const res = await login({
      email: user.email,
      password: TEST_PASSWORD,
      accountType: 'HOSPITAL',
    })

    expect(res.status).toBe(401)
  })

  it('rejects an inactive account with 403', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      isActive: false,
    })

    const res = await login({
      email: user.email,
      password: TEST_PASSWORD,
      accountType: 'INDIVIDUAL',
    })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/inactive/i)
  })

  it('rejects a malformed login body with 400', async () => {
    const res = await login({ email: 'not-an-email' })

    expect(res.status).toBe(400)
  })
})
