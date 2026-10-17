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
  createDonorProfile,
  createStaffMember,
} from './helpers/factories'

const app = createApp()

const DAY = 24 * 60 * 60 * 1000

interface TokenUser {
  id: number
  role: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

function tokenFor(
  user: TokenUser,
  passwordVersion = 0
): string {
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

interface UnitOverrides {
  bagId?: string
  bloodType?: string
  component?: string
  collectionDate?: Date
  expiryDate?: Date
  screeningStatus?: string
  confirmationStatus?: string
  status?: string
}

async function addUnit(
  hospitalProfileId: number,
  overrides: UnitOverrides = {}
) {
  return prisma.bloodUnit.create({
    data: {
      hospitalProfileId,
      bagId: overrides.bagId ?? `BAG-${randomUUID().slice(0, 8)}`,
      bloodType: (overrides.bloodType ?? 'O_NEGATIVE') as never,
      component: (overrides.component ??
        'RED_CELLS') as never,
      collectionDate:
        overrides.collectionDate ??
        new Date(Date.now() - 5 * DAY),
      expiryDate:
        overrides.expiryDate ??
        new Date(Date.now() + 30 * DAY),
      screeningStatus: (overrides.screeningStatus ??
        'PASSED') as never,
      confirmationStatus: (overrides.confirmationStatus ??
        'CONFIRMED') as never,
      status: (overrides.status ?? 'AVAILABLE') as never,
      storageLocation: 'Fridge A',
    },
  })
}

interface DonorOverrides {
  bloodType?: string
  verificationStatus?: string
  currentAvailability?: string
  consentToContact?: boolean
  shareLocation?: boolean
  address?: string
  lastDonation?: Date | null
}

async function addVerifiedDonor(
  overrides: DonorOverrides = {}
) {
  const { user } = await createUser({
    accountType: 'INDIVIDUAL',
  })

  const profile = await createDonorProfile(user.id)

  return prisma.donorProfile.update({
    where: { id: profile.id },
    data: {
      bloodType: (overrides.bloodType ??
        'O_NEGATIVE') as never,
      verificationStatus: (overrides.verificationStatus ??
        'VERIFIED') as never,
      currentAvailability: (overrides.currentAvailability ??
        'AVAILABLE') as never,
      consentToContact: overrides.consentToContact ?? true,
      shareLocation: overrides.shareLocation ?? true,
      address: overrides.address ?? 'Addis Ababa',
      lastDonation: overrides.lastDonation ?? null,
    },
  })
}

function validRequestBody(
  overrides: Record<string, unknown> = {}
) {
  return {
    component: 'RED_CELLS',
    bloodType: 'O_NEGATIVE',
    requiredUnits: 2,
    urgency: 'ROUTINE',
    location: 'Addis Ababa',
    ...overrides,
  }
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('blood request authorization', () => {
  it('denies individuals with no hospital access', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(tokenFor(user)))
      .send(validRequestBody())

    expect(res.status).toBe(403)
  })

  it('denies viewers from creating requests', async () => {
    const { hospitalProfileId } = await approvedHospital()

    const { user: viewer } = await createStaffMember(
      hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(tokenFor(viewer)))
      .send(validRequestBody())

    expect(res.status).toBe(403)
  })

  it('never exposes another hospital request', async () => {
    const hospitalA = await approvedHospital()
    const hospitalB = await approvedHospital()

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(hospitalA.token))
      .send(validRequestBody())

    const requestId = created.body.request.id

    const readB = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Authorization', auth(hospitalB.token))

    expect(readB.status).toBe(404)

    const matchesB = await request(app)
      .get(`/api/matching/requests/${requestId}/matches`)
      .set('Authorization', auth(hospitalB.token))

    expect(matchesB.status).toBe(404)
  })
})

describe('blood request creation', () => {
  it('creates and lists a request for the hospital', async () => {
    const { token } = await approvedHospital()

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(token))
      .send(
        validRequestBody({
          component: 'PLATELETS',
          bloodType: 'A_POSITIVE',
          requiredUnits: 3,
          urgency: 'URGENT',
        })
      )

    expect(created.status).toBe(201)
    expect(created.body.request.status).toBe('OPEN')
    expect(created.body.request.component).toBe('PLATELETS')
    expect(created.body.request.requiredUnits).toBe(3)

    const listed = await request(app)
      .get('/api/requests')
      .set('Authorization', auth(token))

    expect(listed.status).toBe(200)
    expect(listed.body.requests).toHaveLength(1)
  })

  it('rejects an invalid body', async () => {
    const { token } = await approvedHospital()

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(token))
      .send(validRequestBody({ requiredUnits: 0 }))

    expect(res.status).toBe(400)
  })

  it('updates the request status', async () => {
    const { token } = await approvedHospital()

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(token))
      .send(validRequestBody())

    const updated = await request(app)
      .patch(`/api/requests/${created.body.request.id}/status`)
      .set('Authorization', auth(token))
      .send({ status: 'FULFILLED' })

    expect(updated.status).toBe(200)
    expect(updated.body.request.status).toBe('FULFILLED')
  })
})

describe('matching hospital inventory', () => {
  it('returns only available, screened, confirmed, unexpired compatible units', async () => {
    const requester = await approvedHospital()
    const source = await approvedHospital()

    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      expiryDate: new Date(Date.now() + 10 * DAY),
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      expiryDate: new Date(Date.now() + 20 * DAY),
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_POSITIVE',
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'A_NEGATIVE',
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      screeningStatus: 'PENDING',
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      confirmationStatus: 'PENDING',
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      status: 'RESERVED',
    })
    await addUnit(source.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      collectionDate: new Date(Date.now() - 40 * DAY),
      expiryDate: new Date(Date.now() - DAY),
    })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(validRequestBody())

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    expect(matches.status).toBe(200)

    const units = matches.body.matches.units

    expect(units).toHaveLength(2)
    expect(units[0].fefoRank).toBe(1)
    expect(units[1].fefoRank).toBe(2)
    expect(
      new Date(units[0].expiryDate).getTime()
    ).toBeLessThan(new Date(units[1].expiryDate).getTime())
    expect(units[0].hospitalName).toBeDefined()
    expect(units[0].bloodType).toBe('O_NEGATIVE')
  })

  it('includes the requesting hospital units but flags them', async () => {
    const requester = await approvedHospital()

    await addUnit(requester.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
    })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(validRequestBody())

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    expect(matches.body.matches.units).toHaveLength(1)
    expect(
      matches.body.matches.units[0].isOwnHospital
    ).toBe(true)
  })

  it("ignores unapproved hospitals' inventory", async () => {
    const requester = await approvedHospital()

    const { user: pendingUser } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })

    await addUnit(pendingUser.hospitalProfile!.id, {
      bloodType: 'O_NEGATIVE',
    })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(validRequestBody())

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    expect(matches.body.matches.units).toHaveLength(0)
  })

  it('matches only the requested component', async () => {
    const requester = await approvedHospital()

    await addUnit(requester.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      component: 'RED_CELLS',
    })
    await addUnit(requester.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      component: 'PLASMA',
    })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(
        validRequestBody({
          component: 'RED_CELLS',
          bloodType: 'O_POSITIVE',
        })
      )

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    expect(matches.body.matches.units).toHaveLength(1)
    expect(
      matches.body.matches.units[0].component
    ).toBe('RED_CELLS')
  })
})

describe('matching donors', () => {
  it('ranks eligible compatible donors and hides private details', async () => {
    const requester = await approvedHospital()

    await addVerifiedDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: true,
      shareLocation: true,
      address: 'Addis Ababa, Bole',
    })

    await addVerifiedDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: false,
      shareLocation: false,
      address: 'Addis Ababa, Kirkos',
    })

    await addVerifiedDonor({
      bloodType: 'O_POSITIVE',
      consentToContact: true,
    })

    await addVerifiedDonor({
      bloodType: 'O_NEGATIVE',
      verificationStatus: 'PENDING',
    })

    await addVerifiedDonor({
      bloodType: 'O_NEGATIVE',
      currentAvailability: 'UNAVAILABLE',
    })

    await addVerifiedDonor({
      bloodType: 'O_NEGATIVE',
      lastDonation: new Date(Date.now() - 10 * DAY),
    })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(validRequestBody())

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    expect(matches.status).toBe(200)

    const donors = matches.body.matches.donors

    expect(donors).toHaveLength(2)

    // Ranked first: consented donor in the request location.
    expect(donors[0].contactAllowed).toBe(true)
    expect(donors[0].contactPhone).toBeTruthy()
    expect(donors[0].address).toBe('Addis Ababa, Bole')
    expect(donors[0].rank).toBe(1)

    // Second: no consent, no shared location.
    expect(donors[1].contactAllowed).toBe(false)
    expect(donors[1].contactPhone).toBeNull()
    expect(donors[1].address).toBeNull()
    expect(donors[1].displayName).toMatch(
      /^Verified donor #/
    )

    // Never leaks clinical measurements.
    expect(donors[0]).not.toHaveProperty('weight')
    expect(donors[0]).not.toHaveProperty('height')
    expect(donors[0]).not.toHaveProperty('faydaId')
    expect(donors[0]).not.toHaveProperty('dateOfBirth')
  })

  it('applies reversed ABO rules for plasma requests', async () => {
    const requester = await approvedHospital()

    await addVerifiedDonor({ bloodType: 'A_NEGATIVE' })
    await addVerifiedDonor({ bloodType: 'AB_POSITIVE' })
    await addVerifiedDonor({ bloodType: 'B_POSITIVE' })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(
        validRequestBody({
          component: 'PLASMA',
          bloodType: 'A_POSITIVE',
        })
      )

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    const types = matches.body.matches.donors.map(
      (donor: { bloodType: string }) => donor.bloodType
    )

    expect(types).toContain('A_NEGATIVE')
    expect(types).toContain('AB_POSITIVE')
    expect(types).not.toContain('B_POSITIVE')
  })

  it('reports the shortfall against required units', async () => {
    const requester = await approvedHospital()

    await addUnit(requester.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
    })

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', auth(requester.token))
      .send(validRequestBody({ requiredUnits: 5 }))

    const matches = await request(app)
      .get(
        `/api/matching/requests/${created.body.request.id}/matches`
      )
      .set('Authorization', auth(requester.token))

    expect(matches.body.matches.summary.compatibleUnits).toBe(1)
    expect(matches.body.matches.summary.shortfall).toBe(4)
    expect(matches.body.matches.disclaimer).toMatch(
      /not a clinical transfusion decision/i
    )
  })
})
