import request from 'supertest'
import { existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import { createDonorProfile, createUser } from './helpers/factories'
import { adminUser, auth, tokenFor } from './helpers/actors'
import { REPORT_DIR } from '../src/middleware/upload.middleware'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

async function donorActor() {
  const { user } = await createUser({ accountType: 'INDIVIDUAL' })
  const profile = await createDonorProfile(user.id)

  return { user, token: tokenFor(user), profileId: profile.id }
}

function validProfileBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    phone: '+251900000123',
    address: 'Addis Ababa, Kirkos',
    weight: 72,
    height: 176,
    ...overrides,
  }
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('donor profile management', () => {
  it('updates the authenticated donor profile', async () => {
    const { token, profileId } = await donorActor()

    const res = await request(app)
      .put('/api/donor/profile')
      .set('Authorization', auth(token))
      .send(
        validProfileBody({
          bloodType: 'A_POSITIVE',
          consentToContact: true,
          shareLocation: true,
        })
      )

    expect(res.status).toBe(200)
    expect(res.body.profile.phone).toBe('+251900000123')
    expect(res.body.profile.bloodType).toBe('A_POSITIVE')
    expect(res.body.profile.consentToContact).toBe(true)

    const stored = await prisma.donorProfile.findUnique({
      where: { id: profileId },
    })

    expect(stored?.bloodType).toBe('A_POSITIVE')
    expect(stored?.address).toBe('Addis Ababa, Kirkos')
  })

  it('rejects an incomplete profile update', async () => {
    const { token } = await donorActor()

    const res = await request(app)
      .put('/api/donor/profile')
      .set('Authorization', auth(token))
      .send({ phone: '+251900000123' })

    expect(res.status).toBe(400)
  })

  it('denies hospital accounts access to donor-only endpoints', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: true,
    })

    const res = await request(app)
      .get('/api/donor/profile')
      .set('Authorization', auth(tokenFor(user)))

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/donor access/i)
  })

  it('never exposes password material through /users/me', async () => {
    const { token } = await donorActor()

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', auth(token))

    expect(res.status).toBe(200)
    expect(res.body.user).not.toHaveProperty('passwordHash')
    expect(res.body.user).not.toHaveProperty('passwordVersion')
  })
})

describe('donor availability', () => {
  it('stores weekly availability and the current status', async () => {
    const { token, profileId } = await donorActor()

    const res = await request(app)
      .put('/api/donor/availability')
      .set('Authorization', auth(token))
      .send({
        currentAvailability: 'AVAILABLE',
        availabilities: [
          { day: 'MONDAY', time: '09:00' },
          { day: 'WEDNESDAY', time: '14:30' },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.profile.currentAvailability).toBe('AVAILABLE')
    expect(res.body.profile.availabilities).toHaveLength(2)

    const rows = await prisma.donorAvailabilitySchedule.findMany({
      where: { donorProfileId: profileId },
    })

    expect(rows).toHaveLength(2)
  })

  it('rejects duplicate weekdays', async () => {
    const { token } = await donorActor()

    const res = await request(app)
      .put('/api/donor/availability')
      .set('Authorization', auth(token))
      .send({
        currentAvailability: 'AVAILABLE',
        availabilities: [
          { day: 'MONDAY', time: '09:00' },
          { day: 'MONDAY', time: '10:00' },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cannot repeat/i)
  })
})

describe('medical report privacy and verification', () => {
  it('scopes report listing, streaming and resets verification on re-upload', async () => {
    const donorA = await donorActor()
    const donorB = await donorActor()

    const upload = await request(app)
      .post('/api/donor/reports')
      .set('Authorization', auth(donorA.token))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report.png',
        contentType: 'image/png',
      })

    expect(upload.status).toBe(201)

    const reportId = upload.body.report.id

    const listA = await request(app)
      .get('/api/donor/reports')
      .set('Authorization', auth(donorA.token))

    expect(listA.body.reports).toHaveLength(1)

    const listB = await request(app)
      .get('/api/donor/reports')
      .set('Authorization', auth(donorB.token))

    expect(listB.body.reports).toHaveLength(0)

    const own = await request(app)
      .get(`/api/donor/reports/${reportId}/file`)
      .set('Authorization', auth(donorA.token))

    expect(own.status).toBe(200)

    const foreign = await request(app)
      .get(`/api/donor/reports/${reportId}/file`)
      .set('Authorization', auth(donorB.token))

    expect(foreign.status).toBe(404)

    // Approving must be undone by any new upload so a stale approval can
    // never authorise a donor.
    const admin = await adminUser()

    const verified = await request(app)
      .patch(
        `/api/donor/registrations/${donorA.profileId}/verification`
      )
      .set('Authorization', auth(admin.token))
      .send({ decision: 'VERIFY' })

    expect(verified.status).toBe(200)
    expect(verified.body.donor.verificationStatus).toBe('VERIFIED')

    const reupload = await request(app)
      .post('/api/donor/reports')
      .set('Authorization', auth(donorA.token))
      .field('reportType', 'IMAGE')
      .attach('medicalReport', PNG_BUFFER, {
        filename: 'report-2.png',
        contentType: 'image/png',
      })

    expect(reupload.status).toBe(201)

    const stored = await prisma.donorProfile.findUnique({
      where: { id: donorA.profileId },
    })

    expect(stored?.verificationStatus).toBe('PENDING')

    const filePath = path.join(
      REPORT_DIR,
      path.basename(upload.body.report.fileUrl)
    )

    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  })

  it('requires a reason to reject or request more information', async () => {
    const donor = await donorActor()
    const admin = await adminUser()

    const rejected = await request(app)
      .patch(
        `/api/donor/registrations/${donor.profileId}/verification`
      )
      .set('Authorization', auth(admin.token))
      .send({ decision: 'REJECT' })

    expect(rejected.status).toBe(400)

    const requested = await request(app)
      .patch(
        `/api/donor/registrations/${donor.profileId}/verification`
      )
      .set('Authorization', auth(admin.token))
      .send({
        decision: 'REQUEST_INFO',
        notes: 'Please upload a clearer scan.',
      })

    expect(requested.status).toBe(200)
    expect(requested.body.donor.verificationStatus).toBe(
      'ADDITIONAL_INFO_REQUIRED'
    )
  })

  it('denies non-administrators access to the verification queue', async () => {
    const donor = await donorActor()

    const res = await request(app)
      .get('/api/donor/registrations')
      .set('Authorization', auth(donor.token))

    expect(res.status).toBe(403)
  })
})

describe('donor eligibility and dashboard', () => {
  it('reports an eligible verified donor', async () => {
    const { user, token } = await donorActor()

    await prisma.donorProfile.update({
      where: { userId: user.id },
      data: { verificationStatus: 'VERIFIED' },
    })

    const res = await request(app)
      .get('/api/donor/dashboard')
      .set('Authorization', auth(token))

    expect(res.status).toBe(200)
    expect(res.body.eligibility.eligible).toBe(true)
    expect(res.body.stats.totalDonations).toBe(0)
  })

  it('blocks donors who donated too recently and exposes the next date', async () => {
    const { user, token } = await donorActor()

    await prisma.donorProfile.update({
      where: { userId: user.id },
      data: {
        verificationStatus: 'VERIFIED',
        lastDonation: new Date(Date.now() - 10 * DAY),
      },
    })

    const res = await request(app)
      .get('/api/donor/eligibility')
      .set('Authorization', auth(token))

    expect(res.status).toBe(200)
    expect(res.body.eligibility.eligible).toBe(false)
    expect(res.body.eligibility.nextEligibleDate).toBeTruthy()
    expect(res.body.eligibility.daysUntilEligible).toBeGreaterThan(0)

    const interval = res.body.eligibility.checks.find(
      (check: { key: string }) => check.key === 'interval'
    )

    expect(interval.passed).toBe(false)
  })

  it('records donation history and keeps the last donation date', async () => {
    const { user, token } = await donorActor()

    const donatedAt = new Date(Date.now() - 100 * DAY)
      .toISOString()
      .slice(0, 10)

    const res = await request(app)
      .post('/api/donor/history')
      .set('Authorization', auth(token))
      .send({
        donatedAt,
        facilityName: 'Central Blood Bank',
        units: 1,
      })

    expect(res.status).toBe(201)

    const stored = await prisma.donorProfile.findUnique({
      where: { userId: user.id },
    })

    expect(stored?.lastDonation?.toISOString().slice(0, 10)).toBe(
      donatedAt
    )
  })
})
