import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  createUser,
  createStaffMember,
  uniqueEmail,
  uniqueIp,
  TEST_PASSWORD,
} from './helpers/factories'

const app = createApp()

const DAY = 24 * 60 * 60 * 1000

interface TokenUser {
  id: number
  role: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

function tokenFor(user: TokenUser, passwordVersion = 0): string {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      accountType: user.accountType,
      passwordVersion,
    },
    process.env.JWT_SECRET!,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      jwtid: randomUUID(),
    }
  )
}

function auth(token: string): string {
  return `Bearer ${token}`
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY)
    .toISOString()
    .slice(0, 10)
}

async function approvedHospital() {
  const { user } = await createUser({
    accountType: 'HOSPITAL',
    hospitalVerified: true,
  })

  return {
    user,
    token: tokenFor(user),
    hospitalProfileId: user.hospitalProfile!.id,
  }
}

function validUnitBody(
  overrides: Record<string, unknown> = {}
) {
  return {
    bagId: `BAG-${randomUUID().slice(0, 8)}`,
    bloodType: 'O_POSITIVE',
    collectionDate: isoDaysFromNow(-5),
    expiryDate: isoDaysFromNow(30),
    screeningStatus: 'PASSED',
    confirmationStatus: 'CONFIRMED',
    storageLocation: 'Fridge A',
    ...overrides,
  }
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('hospital access control', () => {
  it('allows an unverified hospital to view its profile', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })

    const res = await request(app)
      .get('/api/hospital/profile')
      .set('Authorization', auth(tokenFor(user)))

    expect(res.status).toBe(200)
    expect(res.body.profile.status).toBe('PENDING')
  })

  it('blocks an individual donor from hospital endpoints', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    const res = await request(app)
      .get('/api/hospital/profile')
      .set('Authorization', auth(tokenFor(user)))

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/hospital access/i)
  })

  it('returns the profile and owner role for an approved hospital', async () => {
    const { token, user } = await approvedHospital()

    const res = await request(app)
      .get('/api/hospital/profile')
      .set('Authorization', auth(token))

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('OWNER')
    expect(res.body.profile.id).toBe(user.hospitalProfile!.id)
  })
})

describe('hospital profile', () => {
  it('updates contact details for an owner', async () => {
    const { token, hospitalProfileId } = await approvedHospital()

    const res = await request(app)
      .put('/api/hospital/profile')
      .set('Authorization', auth(token))
      .send({
        hospitalName: 'Updated Hospital',
        address: 'New Address 12',
        phone: '+251911111111',
      })

    expect(res.status).toBe(200)
    expect(res.body.profile.hospitalName).toBe(
      'Updated Hospital'
    )

    const stored = await prisma.hospitalProfile.findUnique({
      where: { id: hospitalProfileId },
    })

    expect(stored?.hospitalName).toBe('Updated Hospital')
    expect(stored?.address).toBe('New Address 12')
  })

  it('rejects an incomplete profile update', async () => {
    const { token } = await approvedHospital()

    const res = await request(app)
      .put('/api/hospital/profile')
      .set('Authorization', auth(token))
      .send({ hospitalName: 'x' })

    expect(res.status).toBe(400)
  })
})

describe('hospital staff management', () => {
  it('adds and lists staff for an owner', async () => {
    const { token } = await approvedHospital()
    const email = uniqueEmail('staff')

    const created = await request(app)
      .post('/api/hospital/staff')
      .set('Authorization', auth(token))
      .send({
        name: 'Staff One',
        email,
        password: TEST_PASSWORD,
        staffRole: 'TECHNICIAN',
      })

    expect(created.status).toBe(201)
    expect(created.body.staff.staffRole).toBe('TECHNICIAN')

    const listed = await request(app)
      .get('/api/hospital/staff')
      .set('Authorization', auth(token))

    expect(listed.status).toBe(200)
    expect(
      listed.body.staff.some(
        (member: { user: { email: string } }) =>
          member.user.email === email
      )
    ).toBe(true)
  })

  it('rejects a duplicate staff email with 409', async () => {
    const { token } = await approvedHospital()
    const email = uniqueEmail('staff')

    const body = {
      name: 'Staff One',
      email,
      password: TEST_PASSWORD,
      staffRole: 'MANAGER',
    }

    expect(
      (
        await request(app)
          .post('/api/hospital/staff')
          .set('Authorization', auth(token))
          .send(body)
      ).status
    ).toBe(201)

    const duplicate = await request(app)
      .post('/api/hospital/staff')
      .set('Authorization', auth(token))
      .send(body)

    expect(duplicate.status).toBe(409)
  })

  it('lets an owner change a staff role and deactivate them', async () => {
    const { token, hospitalProfileId } =
      await approvedHospital()

    const { member } = await createStaffMember(
      hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const updated = await request(app)
      .patch(`/api/hospital/staff/${member.id}`)
      .set('Authorization', auth(token))
      .send({ staffRole: 'MANAGER', isActive: false })

    expect(updated.status).toBe(200)
    expect(updated.body.staff.staffRole).toBe('MANAGER')
    expect(updated.body.staff.isActive).toBe(false)
  })

  it('protects the owner membership from modification', async () => {
    const { token, user, hospitalProfileId } =
      await approvedHospital()

    const ownerMember = await prisma.hospitalStaffMember.create({
      data: {
        hospitalProfileId,
        userId: user.id,
        staffRole: 'OWNER',
      },
    })

    const res = await request(app)
      .patch(`/api/hospital/staff/${ownerMember.id}`)
      .set('Authorization', auth(token))
      .send({ isActive: false })

    expect(res.status).toBe(403)
  })

  it('denies staff management to a viewer', async () => {
    const { hospitalProfileId } = await approvedHospital()

    const { user: viewer } = await createStaffMember(
      hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const res = await request(app)
      .get('/api/hospital/staff')
      .set('Authorization', auth(tokenFor(viewer)))

    expect(res.status).toBe(403)
  })
})

describe('blood inventory', () => {
  it('adds a fully screened, confirmed unit as available', async () => {
    const { token } = await approvedHospital()

    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(validUnitBody())

    expect(res.status).toBe(201)
    expect(res.body.unit.isAvailable).toBe(true)
    expect(res.body.unit.isExpired).toBe(false)
  })

  it('excludes expired, unscreened and unconfirmed units from available stock', async () => {
    const { token } = await approvedHospital()

    await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(validUnitBody())

    await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(
        validUnitBody({
          screeningStatus: 'PENDING',
          confirmationStatus: 'PENDING',
        })
      )

    await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(
        validUnitBody({
          collectionDate: isoDaysFromNow(-40),
          expiryDate: isoDaysFromNow(-1),
        })
      )

    const available = await request(app)
      .get('/api/inventory?availability=available')
      .set('Authorization', auth(token))

    expect(available.status).toBe(200)
    expect(available.body.units).toHaveLength(1)

    const all = await request(app)
      .get('/api/inventory?availability=all')
      .set('Authorization', auth(token))

    expect(all.body.units).toHaveLength(3)
  })

  it('rejects an expiry date before the collection date', async () => {
    const { token } = await approvedHospital()

    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(
        validUnitBody({
          collectionDate: isoDaysFromNow(10),
          expiryDate: isoDaysFromNow(5),
        })
      )

    expect(res.status).toBe(400)
  })

  it('rejects a duplicate bag id with 409', async () => {
    const { token } = await approvedHospital()
    const body = validUnitBody()

    expect(
      (
        await request(app)
          .post('/api/inventory')
          .set('Authorization', auth(token))
          .send(body)
      ).status
    ).toBe(201)

    const duplicate = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(body)

    expect(duplicate.status).toBe(409)
  })

  it('provides a blood-type summary and expiry alerts', async () => {
    const { token } = await approvedHospital()

    await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(validUnitBody({ bloodType: 'A_POSITIVE' }))

    await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(token))
      .send(
        validUnitBody({
          bloodType: 'A_POSITIVE',
          collectionDate: isoDaysFromNow(-80),
          expiryDate: isoDaysFromNow(3),
        })
      )

    const summary = await request(app)
      .get('/api/inventory/summary')
      .set('Authorization', auth(token))

    expect(summary.status).toBe(200)

    const aPositive = summary.body.summary.types.find(
      (type: { bloodType: string }) =>
        type.bloodType === 'A_POSITIVE'
    )

    expect(aPositive.totalUnits).toBe(2)
    expect(aPositive.availableUnits).toBe(2)

    const alerts = await request(app)
      .get('/api/inventory/alerts?withinDays=7')
      .set('Authorization', auth(token))

    expect(alerts.status).toBe(200)
    expect(alerts.body.alerts).toHaveLength(1)
    expect(alerts.body.alerts[0].status).toBe(
      'EXPIRING_SOON'
    )
  })

  it('denies inventory writes to a viewer', async () => {
    const { hospitalProfileId } = await approvedHospital()

    const { user: viewer } = await createStaffMember(
      hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(tokenFor(viewer)))
      .send(validUnitBody())

    expect(res.status).toBe(403)
  })
})

describe('inventory isolation between hospitals', () => {
  it('never exposes or modifies another hospital unit', async () => {
    const hospitalA = await approvedHospital()
    const hospitalB = await approvedHospital()

    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospitalA.token))
      .send(validUnitBody())

    const unitId = created.body.unit.id

    const listB = await request(app)
      .get('/api/inventory')
      .set('Authorization', auth(hospitalB.token))

    expect(listB.body.units).toHaveLength(0)

    const readB = await request(app)
      .get(`/api/inventory/${unitId}`)
      .set('Authorization', auth(hospitalB.token))

    expect(readB.status).toBe(404)

    const updateB = await request(app)
      .put(`/api/inventory/${unitId}`)
      .set('Authorization', auth(hospitalB.token))
      .send({ storageLocation: 'Hijacked' })

    expect(updateB.status).toBe(404)

    const stillOwned = await prisma.bloodUnit.findUnique({
      where: { id: unitId },
    })

    expect(stillOwned?.hospitalProfileId).toBe(
      hospitalA.hospitalProfileId
    )
    expect(stillOwned?.storageLocation).toBe('Fridge A')
  })
})

describe('administrator hospital approval', () => {
  async function adminToken() {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      role: 'ADMIN',
    })

    return tokenFor(user)
  }

  it('approves a pending hospital and activates its account', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
      isActive: false,
    })

    const blockedLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        email: user.email,
        password: TEST_PASSWORD,
        accountType: 'HOSPITAL',
      })

    expect(blockedLogin.status).toBe(403)

    const token = await adminToken()

    const review = await request(app)
      .post(
        `/api/hospital/admin/hospitals/${user.hospitalProfile!.id}/review`
      )
      .set('Authorization', auth(token))
      .send({ decision: 'APPROVE' })

    expect(review.status).toBe(200)
    expect(review.body.hospital.isVerified).toBe(true)
    expect(review.body.hospital.status).toBe('APPROVED')

    const allowedLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({
        email: user.email,
        password: TEST_PASSWORD,
        accountType: 'HOSPITAL',
      })

    expect(allowedLogin.status).toBe(200)
  })

  it('requires a reason to reject a hospital', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })

    const token = await adminToken()

    const res = await request(app)
      .post(
        `/api/hospital/admin/hospitals/${user.hospitalProfile!.id}/review`
      )
      .set('Authorization', auth(token))
      .send({ decision: 'REJECT' })

    expect(res.status).toBe(400)
  })

  it('denies the approval endpoints to non-administrators', async () => {
    const { token } = await approvedHospital()

    const res = await request(app)
      .get('/api/hospital/admin/hospitals')
      .set('Authorization', auth(token))

    expect(res.status).toBe(403)
  })
})
