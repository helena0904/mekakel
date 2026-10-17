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
} from './helpers/factories'
import { runExpireReservationsJob } from '../src/jobs/expire-reservations.job'

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
  bloodType?: string
  component?: string
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
      bagId: `BAG-${randomUUID().slice(0, 8)}`,
      bloodType: (overrides.bloodType ?? 'O_NEGATIVE') as never,
      component: (overrides.component ?? 'RED_CELLS') as never,
      collectionDate: new Date(Date.now() - 5 * DAY),
      expiryDate:
        overrides.expiryDate ?? new Date(Date.now() + 30 * DAY),
      screeningStatus: (overrides.screeningStatus ??
        'PASSED') as never,
      confirmationStatus: (overrides.confirmationStatus ??
        'CONFIRMED') as never,
      status: (overrides.status ?? 'AVAILABLE') as never,
    },
  })
}

async function openRequest(hospitalProfileId: number) {
  return prisma.bloodRequest.create({
    data: {
      hospitalProfileId,
      createdByUserId: 0,
      component: 'RED_CELLS',
      bloodType: 'O_NEGATIVE',
      requiredUnits: 1,
      urgency: 'ROUTINE',
      status: 'OPEN',
    },
  })
}

function reserveBody(
  bloodUnitId: number,
  overrides: Record<string, unknown> = {}
) {
  return { bloodUnitId, ...overrides }
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('reservation authorization', () => {
  it('denies individuals with no hospital access', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(tokenFor(user)))
      .send({ bloodUnitId: 1 })

    expect(res.status).toBe(403)
  })

  it('denies viewers from reserving units', async () => {
    const { hospitalProfileId } = await approvedHospital()
    const unit = await addUnit(hospitalProfileId)

    const { user: viewer } = await createStaffMember(
      hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(tokenFor(viewer)))
      .send({ bloodUnitId: unit.id })

    expect(res.status).toBe(403)
  })
})

describe('creating reservations', () => {
  it('reserves an eligible unit and flips it to RESERVED', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id))

    expect(res.status).toBe(201)
    expect(res.body.reservation.status).toBe('ACTIVE')
    expect(res.body.reservation.bloodUnit.status).toBe('RESERVED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('RESERVED')
  })

  it('rejects ineligible units (unscreened or expired)', async () => {
    const hospital = await approvedHospital()

    const pending = await addUnit(
      hospital.hospitalProfileId,
      { screeningStatus: 'PENDING' }
    )
    const expired = await addUnit(
      hospital.hospitalProfileId,
      { expiryDate: new Date(Date.now() - DAY) }
    )

    const pendingRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(pending.id))

    const expiredRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(expired.id))

    expect(pendingRes.status).toBe(409)
    expect(expiredRes.status).toBe(409)
  })

  it('rejects reserving a unit it does not own', async () => {
    const hospitalA = await approvedHospital()
    const hospitalB = await approvedHospital()
    const unit = await addUnit(hospitalA.hospitalProfileId)

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospitalB.token))
      .send(reserveBody(unit.id))

    expect(res.status).toBe(404)
  })

  it('links an open blood request and rejects closed ones', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)
    const open = await openRequest(hospital.hospitalProfileId)

    const created = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id, { bloodRequestId: open.id }))

    expect(created.status).toBe(201)
    expect(created.body.reservation.bloodRequestId).toBe(open.id)

    const secondUnit = await addUnit(hospital.hospitalProfileId)

    await prisma.bloodRequest.update({
      where: { id: open.id },
      data: { status: 'CANCELLED' },
    })

    const rejected = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(secondUnit.id, { bloodRequestId: open.id }))

    expect(rejected.status).toBe(409)
  })
})

describe('double reservation protection', () => {
  it('rejects a second sequential reservation of the same unit', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const first = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id))

    const second = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id))

    expect(first.status).toBe(201)
    expect(second.status).toBe(409)
  })

  it('never lets concurrent requests claim the same unit', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const [a, b] = await Promise.all([
      request(app)
        .post('/api/reservations')
        .set('Authorization', auth(hospital.token))
        .send(reserveBody(unit.id)),
      request(app)
        .post('/api/reservations')
        .set('Authorization', auth(hospital.token))
        .send(reserveBody(unit.id)),
    ])

    const statuses = [a.status, b.status].sort()

    expect(statuses).toEqual([201, 409])

    const reservations = await prisma.reservation.findMany({
      where: { bloodUnitId: unit.id },
    })

    expect(reservations).toHaveLength(1)
    expect(reservations[0].status).toBe('ACTIVE')
  })
})

describe('reservation transitions', () => {
  async function reserve(
    hospital: Awaited<ReturnType<typeof approvedHospital>>
  ) {
    const unit = await addUnit(hospital.hospitalProfileId)

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id))

    return { unit, reservation: res.body.reservation }
  }

  it('confirms then consumes a reservation, marking the unit used', async () => {
    const hospital = await approvedHospital()
    const { unit, reservation } = await reserve(hospital)

    const confirmed = await request(app)
      .post(`/api/reservations/${reservation.id}/confirm`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(confirmed.status).toBe(200)
    expect(confirmed.body.reservation.status).toBe('CONFIRMED')

    const consumed = await request(app)
      .post(`/api/reservations/${reservation.id}/consume`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(consumed.status).toBe(200)
    expect(consumed.body.reservation.status).toBe('CONSUMED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('USED')
  })

  it('returns a cancelled eligible unit to AVAILABLE', async () => {
    const hospital = await approvedHospital()
    const { unit, reservation } = await reserve(hospital)

    const cancelled = await request(app)
      .post(`/api/reservations/${reservation.id}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({ reason: 'Request withdrawn' })

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.reservation.status).toBe('CANCELLED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')
  })

  it('discards a cancelled unit that expired while reserved', async () => {
    const hospital = await approvedHospital()
    const { unit, reservation } = await reserve(hospital)

    await prisma.bloodUnit.update({
      where: { id: unit.id },
      data: { expiryDate: new Date(Date.now() - DAY) },
    })

    const cancelled = await request(app)
      .post(`/api/reservations/${reservation.id}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(cancelled.status).toBe(200)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('DISCARDED')
  })

  it('releases a reservation back to the pool', async () => {
    const hospital = await approvedHospital()
    const { unit, reservation } = await reserve(hospital)

    const released = await request(app)
      .post(`/api/reservations/${reservation.id}/release`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(released.status).toBe(200)
    expect(released.body.reservation.status).toBe('RELEASED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')
  })

  it('cannot confirm a reservation that is already cancelled', async () => {
    const hospital = await approvedHospital()
    const { reservation } = await reserve(hospital)

    await request(app)
      .post(`/api/reservations/${reservation.id}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({})

    const confirmed = await request(app)
      .post(`/api/reservations/${reservation.id}/confirm`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(confirmed.status).toBe(409)
  })

  it('hides reservations from other hospitals', async () => {
    const hospitalA = await approvedHospital()
    const hospitalB = await approvedHospital()
    const { reservation } = await reserve(hospitalA)

    const res = await request(app)
      .get(`/api/reservations/${reservation.id}`)
      .set('Authorization', auth(hospitalB.token))

    expect(res.status).toBe(404)
  })
})

describe('donor response tracking', () => {
  it('records acceptance, decline and no-show outcomes', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const { user: donorUser } = await createUser({
      accountType: 'INDIVIDUAL',
    })
    const donor = await prisma.donorProfile.create({
      data: {
        userId: donorUser.id,
        phone: '+251900000000',
        address: 'Addis Ababa',
        age: 25,
        weight: 70,
        height: 175,
      },
    })

    const created = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id, { donorProfileId: donor.id }))

    expect(created.status).toBe(201)
    expect(created.body.reservation.donorResponse).toBe('PENDING')

    const accepted = await request(app)
      .patch(`/api/reservations/${created.body.reservation.id}/donor-response`)
      .set('Authorization', auth(hospital.token))
      .send({ donorResponse: 'ACCEPTED' })

    expect(accepted.status).toBe(200)
    expect(accepted.body.reservation.donorResponse).toBe(
      'ACCEPTED'
    )
    expect(
      accepted.body.reservation.donorRespondedAt
    ).toBeTruthy()

    const noShow = await request(app)
      .patch(`/api/reservations/${created.body.reservation.id}/donor-response`)
      .set('Authorization', auth(hospital.token))
      .send({ donorResponse: 'NO_SHOW' })

    expect(noShow.status).toBe(200)
    expect(noShow.body.reservation.donorResponse).toBe(
      'NO_SHOW'
    )
  })
})

describe('reservation expiry job', () => {
  it('expires due reservations and returns eligible units to stock', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send(reserveBody(unit.id))

    await prisma.reservation.update({
      where: { id: created.body.reservation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    })

    const result = await runExpireReservationsJob()

    expect(result.expired).toBe(1)

    const reservation = await prisma.reservation.findUnique({
      where: { id: created.body.reservation.id },
    })
    const storedUnit = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(reservation?.status).toBe('EXPIRED')
    expect(storedUnit?.status).toBe('AVAILABLE')
  })
})
