import request from 'supertest'
import nodemailer from 'nodemailer'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  MOCK_FAYDA,
  TEST_PASSWORD,
  ageFromDob,
  uniqueEmail,
  uniqueIp,
} from './helpers/factories'
import { adminUser, auth } from './helpers/actors'

const app = createApp()

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

function login(
  email: string,
  password: string,
  accountType = 'INDIVIDUAL'
) {
  return request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password, accountType })
}

let sendMailMock: jest.Mock

beforeEach(async () => {
  await resetDatabase()

  sendMailMock = jest.fn().mockResolvedValue({})

  jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
    sendMail: sendMailMock,
    verify: jest.fn().mockResolvedValue(true),
  } as unknown as nodemailer.Transporter)
})

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(disconnectDatabase)

describe('full authentication journey', () => {
  it('registers, logs in, reads the session and logs out', async () => {
    const identity = MOCK_FAYDA[0]
    const email = uniqueEmail('journey')

    const register = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .field('name', identity.fullName)
      .field('email', email)
      .field('password', TEST_PASSWORD)
      .field('accountType', 'INDIVIDUAL')
      .field('faydaId', identity.faydaId)
      .field('dateOfBirth', identity.dateOfBirth)
      .field('phone', '+251900000001')
      .field('address', 'Addis Ababa')
      .field('age', String(ageFromDob(identity.dateOfBirth)))
      .field('weight', '70')
      .field('height', '175')
      .field('currentAvailability', 'AVAILABLE')
      .field('availabilities', JSON.stringify([]))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    expect(register.status).toBe(201)

    const loginRes = await login(email, TEST_PASSWORD)
    expect(loginRes.status).toBe(200)

    const token = loginRes.body.token as string
    expect(token).toBeTruthy()

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(token))

    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe(email)
    expect(me.body.user.role).toBe('DONOR')
    expect(me.body.user.donorProfile.verificationStatus).toBe(
      'PENDING'
    )

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', auth(token))

    expect(logout.status).toBe(200)

    const afterLogout = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(token))

    expect(afterLogout.status).toBe(401)
    expect(afterLogout.body.message).toMatch(/logged out/i)
  })
})

describe('password recovery lifecycle', () => {
  it('resets the password, invalidates old sessions and consumes the token', async () => {
    const identity = MOCK_FAYDA[1]
    const email = uniqueEmail('recover')

    await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .field('name', identity.fullName)
      .field('email', email)
      .field('password', TEST_PASSWORD)
      .field('accountType', 'INDIVIDUAL')
      .field('faydaId', identity.faydaId)
      .field('dateOfBirth', identity.dateOfBirth)
      .field('phone', '+251900000002')
      .field('address', 'Addis Ababa')
      .field('age', String(ageFromDob(identity.dateOfBirth)))
      .field('weight', '68')
      .field('height', '170')
      .field('currentAvailability', 'AVAILABLE')
      .field('availabilities', JSON.stringify([]))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    const session = await login(email, TEST_PASSWORD)
    const oldToken = session.body.token as string

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email })

    expect(forgot.status).toBe(200)

    const mail = sendMailMock.mock.calls.at(-1)![0] as {
      text: string
    }
    const match = mail.text.match(/token=([a-f0-9]{64})/)

    expect(match).not.toBeNull()

    const resetToken = match![1]

    const shortPassword = await request(app)
      .post('/api/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: 'short1!' })

    expect(shortPassword.status).toBe(400)

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: 'Brand2!New' })

    expect(reset.status).toBe(200)

    const oldLogin = await login(email, TEST_PASSWORD)
    expect(oldLogin.status).toBe(401)

    const newLogin = await login(email, 'Brand2!New')
    expect(newLogin.status).toBe(200)

    // The pre-reset session is now revoked by the password version bump.
    const stale = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(oldToken))

    expect(stale.status).toBe(401)

    // Tokens are single-use.
    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: resetToken, password: 'Other3!Pass' })

    expect(reuse.status).toBe(400)
  })
})

describe('session invalidation on administrative changes', () => {
  it('invalidates existing sessions when a role changes', async () => {
    const admin = await adminUser()
    const identity = MOCK_FAYDA[2]
    const email = uniqueEmail('rolechange')

    const register = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .field('name', identity.fullName)
      .field('email', email)
      .field('password', TEST_PASSWORD)
      .field('accountType', 'INDIVIDUAL')
      .field('faydaId', identity.faydaId)
      .field('dateOfBirth', identity.dateOfBirth)
      .field('phone', '+251900000003')
      .field('address', 'Addis Ababa')
      .field('age', String(ageFromDob(identity.dateOfBirth)))
      .field('weight', '75')
      .field('height', '180')
      .field('currentAvailability', 'AVAILABLE')
      .field('availabilities', JSON.stringify([]))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    const userId = register.body.user.id

    const session = await login(email, TEST_PASSWORD)
    const token = session.body.token as string

    const changed = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set('Authorization', auth(admin.token))
      .send({ role: 'DOCTOR' })

    expect(changed.status).toBe(200)

    const stale = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(token))

    expect(stale.status).toBe(401)

    const relogin = await login(email, TEST_PASSWORD)
    expect(relogin.body.user.role).toBe('DOCTOR')
  })

  it('blocks login for a deactivated account', async () => {
    const admin = await adminUser()
    const identity = MOCK_FAYDA[3]
    const email = uniqueEmail('deactivate')

    const register = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .field('name', identity.fullName)
      .field('email', email)
      .field('password', TEST_PASSWORD)
      .field('accountType', 'INDIVIDUAL')
      .field('faydaId', identity.faydaId)
      .field('dateOfBirth', identity.dateOfBirth)
      .field('phone', '+251900000004')
      .field('address', 'Addis Ababa')
      .field('age', String(ageFromDob(identity.dateOfBirth)))
      .field('weight', '80')
      .field('height', '182')
      .field('currentAvailability', 'AVAILABLE')
      .field('availabilities', JSON.stringify([]))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    const userId = register.body.user.id

    const deactivated = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set('Authorization', auth(admin.token))
      .send({ isActive: false })

    expect(deactivated.status).toBe(200)

    const tryLogin = await login(email, TEST_PASSWORD)
    expect(tryLogin.status).toBe(403)
  })

  it('does not reveal which credential was wrong', async () => {
    const identity = MOCK_FAYDA[0]
    const email = uniqueEmail('mismatch')

    await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .field('name', identity.fullName)
      .field('email', email)
      .field('password', TEST_PASSWORD)
      .field('accountType', 'INDIVIDUAL')
      .field('faydaId', identity.faydaId)
      .field('dateOfBirth', identity.dateOfBirth)
      .field('phone', '+251900000005')
      .field('address', 'Addis Ababa')
      .field('age', String(ageFromDob(identity.dateOfBirth)))
      .field('weight', '70')
      .field('height', '175')
      .field('currentAvailability', 'AVAILABLE')
      .field('availabilities', JSON.stringify([]))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    const wrongType = await login(email, TEST_PASSWORD, 'HOSPITAL')
    const wrongPassword = await login(email, 'Wrong1!Pass')

    expect(wrongType.status).toBe(401)
    expect(wrongPassword.status).toBe(401)
    expect(wrongType.body.message).toBe(wrongPassword.body.message)
  })

  it('never stores or returns the raw password', async () => {
    const identity = MOCK_FAYDA[0]
    const email = uniqueEmail('hashed')

    await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .field('name', identity.fullName)
      .field('email', email)
      .field('password', TEST_PASSWORD)
      .field('accountType', 'INDIVIDUAL')
      .field('faydaId', identity.faydaId)
      .field('dateOfBirth', identity.dateOfBirth)
      .field('phone', '+251900000006')
      .field('address', 'Addis Ababa')
      .field('age', String(ageFromDob(identity.dateOfBirth)))
      .field('weight', '70')
      .field('height', '175')
      .field('currentAvailability', 'AVAILABLE')
      .field('availabilities', JSON.stringify([]))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    const stored = await prisma.user.findUnique({
      where: { email },
    })

    expect(stored?.passwordHash).toBeTruthy()
    expect(stored?.passwordHash).not.toBe(TEST_PASSWORD)
  })
})
