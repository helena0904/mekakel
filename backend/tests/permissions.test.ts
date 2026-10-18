import request from 'supertest'
import jwt from 'jsonwebtoken'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import { createDonorProfile, createUser } from './helpers/factories'
import {
  adminUser,
  approvedHospital,
  auth,
  doctorUser,
  tokenFor,
} from './helpers/actors'

const app = createApp()

const protectedGetRoutes = [
  '/api/users/me',
  '/api/donor/profile',
  '/api/hospital/profile',
  '/api/inventory',
  '/api/requests',
  '/api/reservations',
  '/api/transfers',
  '/api/notifications',
  '/api/admin/users',
  '/api/doctor/verifications',
]

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('unauthenticated access', () => {
  it.each(protectedGetRoutes)(
    'rejects anonymous requests to %s',
    async (route) => {
      const res = await request(app).get(route)
      expect(res.status).toBe(401)
    }
  )

  it('rejects a malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not-a-real-token')

    expect(res.status).toBe(401)
  })
})

describe('token integrity', () => {
  it('rejects an expired token', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const expired = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        accountType: user.accountType,
        passwordVersion: 0,
      },
      process.env.JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
        jwtid: 'expired-jti',
      }
    )

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(expired))

    expect(res.status).toBe(401)
  })

  it('rejects a token that is missing required claims', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const missingClaims = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        accountType: user.accountType,
      },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '1h' }
    )

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(missingClaims))

    expect(res.status).toBe(401)
  })

  it('rejects a token whose account no longer exists', async () => {
    const token = tokenFor({
      id: 999999,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
    })

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(token))

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/no longer exists/i)
  })
})

describe('role separation', () => {
  it('denies donors and doctors access to administrator routes', async () => {
    const donor = await createUser({ accountType: 'INDIVIDUAL' })
    const doctor = await doctorUser()

    const donorRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', auth(tokenFor(donor.user)))

    expect(donorRes.status).toBe(403)

    const doctorRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', auth(doctor.token))

    expect(doctorRes.status).toBe(403)

    const auditRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', auth(tokenFor(donor.user)))

    expect(auditRes.status).toBe(403)
  })

  it('denies administrators and donors access to clinical reviewer routes', async () => {
    const admin = await adminUser()
    const donor = await createUser({ accountType: 'INDIVIDUAL' })

    const adminRes = await request(app)
      .get('/api/doctor/verifications')
      .set('Authorization', auth(admin.token))

    expect(adminRes.status).toBe(403)

    const donorRes = await request(app)
      .get('/api/doctor/verifications')
      .set('Authorization', auth(tokenFor(donor.user)))

    expect(donorRes.status).toBe(403)
  })

  it('denies hospital staff access to donor-only routes', async () => {
    const hospital = await approvedHospital()

    const res = await request(app)
      .get('/api/donor/profile')
      .set('Authorization', auth(hospital.token))

    expect(res.status).toBe(403)
  })

  it('denies donors hospital-scoped routes', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const res = await request(app)
      .get('/api/hospital/profile')
      .set('Authorization', auth(tokenFor(user)))

    expect(res.status).toBe(403)
  })
})

describe('sensitive data disclosure', () => {
  it('never returns password hashes through the user directory', async () => {
    const admin = await adminUser()
    await createUser({ accountType: 'INDIVIDUAL' })

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', auth(admin.token))

    expect(res.status).toBe(200)
    expect(res.body.users.length).toBeGreaterThan(0)

    for (const user of res.body.users) {
      expect(user).not.toHaveProperty('passwordHash')
    }
  })

  it('scopes notifications to their owner', async () => {
    const owner = await createUser({ accountType: 'INDIVIDUAL' })
    const stranger = await createUser({ accountType: 'INDIVIDUAL' })

    const notification = await prisma.notification.create({
      data: {
        userId: owner.user.id,
        recipientEmail: owner.user.email,
        type: 'DONOR_REGISTERED',
        category: 'DONOR',
        subject: 'Welcome',
        body: 'Private message',
      },
    })

    const forbidden = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('Authorization', auth(tokenFor(stranger.user)))

    expect(forbidden.status).toBe(404)

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', auth(tokenFor(stranger.user)))

    expect(list.body.notifications).toHaveLength(0)
  })
})

describe('file upload validation', () => {
  async function donorActor() {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    await createDonorProfile(user.id)
    return tokenFor(user)
  }

  it('rejects a report whose MIME type does not match the declared type', async () => {
    const token = await donorActor()

    const res = await request(app)
      .post('/api/donor/reports')
      .set('Authorization', auth(token))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', Buffer.from('%PDF-1.4'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/does not match/i)
  })

  it('rejects a report upload with no file', async () => {
    const token = await donorActor()

    const res = await request(app)
      .post('/api/donor/reports')
      .set('Authorization', auth(token))
      .field('reportType', 'IMAGE')

    expect(res.status).toBe(400)
  })

  it('rejects a report upload with no declared type', async () => {
    const token = await donorActor()

    const res = await request(app)
      .post('/api/donor/reports')
      .set('Authorization', auth(token))
      .attach('medicalReport', Buffer.from('not-an-image'), {
        filename: 'report.png',
        contentType: 'image/png',
      })

    expect(res.status).toBe(400)
  })
})
