import request from 'supertest'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import { createStaffMember } from './helpers/factories'
import {
  addUnit,
  approvedHospital,
  auth,
  tokenFor,
} from './helpers/actors'
import { runExpireReservationsJob } from '../src/jobs/expire-reservations.job'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000

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

function reserve(token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/reservations')
    .set('Authorization', auth(token))
    .send(body)
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('reservation timeouts', () => {
  it('rejects reservation TTLs outside the allowed range', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const tooShort = await reserve(hospital.token, {
      bloodUnitId: unit.id,
      expiresInMinutes: 4,
    })

    expect(tooShort.status).toBe(400)

    const tooLong = await reserve(hospital.token, {
      bloodUnitId: unit.id,
      expiresInMinutes: 10081,
    })

    expect(tooLong.status).toBe(400)
  })

  it('defaults to a 24 hour hold', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const res = await reserve(hospital.token, {
      bloodUnitId: unit.id,
    })

    expect(res.status).toBe(201)

    const ttlMs =
      new Date(res.body.reservation.expiresAt).getTime() -
      Date.now()

    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('expires a hold whose time elapsed and releases the unit', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
      expiresInMinutes: 5,
    })

    await prisma.reservation.update({
      where: { id: created.body.reservation.id },
      data: { expiresAt: new Date(Date.now() - DAY) },
    })

    const result = await runExpireReservationsJob()

    expect(result.expired).toBe(1)

    const stored = await prisma.reservation.findUnique({
      where: { id: created.body.reservation.id },
    })

    expect(stored?.status).toBe('EXPIRED')

    const released = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(released?.status).toBe('AVAILABLE')
  })

  it('expires and discards a hold when the unit becomes ineligible', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
    })

    await prisma.bloodUnit.update({
      where: { id: unit.id },
      data: { screeningStatus: 'FAILED' },
    })

    const result = await runExpireReservationsJob()

    expect(result.expired).toBe(1)

    const stored = await prisma.reservation.findUnique({
      where: { id: created.body.reservation.id },
    })

    expect(stored?.status).toBe('EXPIRED')

    const released = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(released?.status).toBe('DISCARDED')
  })
})

describe('reservation concurrency', () => {
  it('lets exactly one of many concurrent holds win the unit', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        reserve(hospital.token, { bloodUnitId: unit.id })
      )
    )

    const statuses = responses
      .map((res) => res.status)
      .sort()

    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(
      statuses.filter((status) => status === 409)
    ).toHaveLength(5)

    const active = await prisma.reservation.count({
      where: { bloodUnitId: unit.id, status: 'ACTIVE' },
    })

    expect(active).toBe(1)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('RESERVED')
  })

  it('rejects reserving an unavailable or expired unit', async () => {
    const hospital = await approvedHospital()

    const unscreened = await addUnit(hospital.hospitalProfileId, {
      screeningStatus: 'PENDING',
    })
    const expired = await addUnit(hospital.hospitalProfileId, {
      collectionDate: new Date(Date.now() - 40 * DAY),
      expiryDate: new Date(Date.now() - DAY),
    })

    const first = await reserve(hospital.token, {
      bloodUnitId: unscreened.id,
    })
    const second = await reserve(hospital.token, {
      bloodUnitId: expired.id,
    })

    expect(first.status).toBe(409)
    expect(second.status).toBe(409)
  })
})

describe('reservation inventory updates', () => {
  it('returns a cancelled unit to available stock', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
    })

    const cancelled = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({ reason: 'Patient transferred' })

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.reservation.status).toBe('CANCELLED')
    expect(cancelled.body.reservation.cancelledAt).toBeTruthy()

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')

    const again = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(again.status).toBe(409)
  })

  it('discards a cancelled unit that expired while reserved', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
    })

    await prisma.bloodUnit.update({
      where: { id: unit.id },
      data: { expiryDate: new Date(Date.now() - DAY) },
    })

    const cancelled = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(cancelled.status).toBe(200)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('DISCARDED')
  })

  it('marks a consumed unit as used and blocks further transitions', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
    })

    const confirmed = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/confirm`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(confirmed.status).toBe(200)
    expect(confirmed.body.reservation.status).toBe('CONFIRMED')

    const consumed = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/consume`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(consumed.status).toBe(200)
    expect(consumed.body.reservation.status).toBe('CONSUMED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('USED')

    const release = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/release`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(release.status).toBe(409)
  })

  it('releases a held unit back to available stock', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
    })

    const released = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/release`)
      .set('Authorization', auth(hospital.token))
      .send({})

    expect(released.status).toBe(200)
    expect(released.body.reservation.status).toBe('RELEASED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')
  })

  it('links a reservation to an open blood request', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)
    const bloodRequest = await openRequest(hospital.hospitalProfileId)

    const created = await reserve(hospital.token, {
      bloodUnitId: unit.id,
      bloodRequestId: bloodRequest.id,
    })

    expect(created.status).toBe(201)
    expect(created.body.reservation.bloodRequestId).toBe(
      bloodRequest.id
    )

    await prisma.bloodRequest.update({
      where: { id: bloodRequest.id },
      data: { status: 'FULFILLED' },
    })

    const otherUnit = await addUnit(hospital.hospitalProfileId)

    const closed = await reserve(hospital.token, {
      bloodUnitId: otherUnit.id,
      bloodRequestId: bloodRequest.id,
    })

    expect(closed.status).toBe(409)
  })
})

describe('reservation data isolation and roles', () => {
  it('hides reservations and units from other hospitals', async () => {
    const hospitalA = await approvedHospital()
    const hospitalB = await approvedHospital()

    const unit = await addUnit(hospitalA.hospitalProfileId)

    const created = await reserve(hospitalA.token, {
      bloodUnitId: unit.id,
    })

    const readB = await request(app)
      .get(`/api/reservations/${created.body.reservation.id}`)
      .set('Authorization', auth(hospitalB.token))

    expect(readB.status).toBe(404)

    const reserveForeign = await reserve(hospitalB.token, {
      bloodUnitId: unit.id,
    })

    expect(reserveForeign.status).toBe(404)

    const listB = await request(app)
      .get('/api/reservations')
      .set('Authorization', auth(hospitalB.token))

    expect(listB.body.reservations).toHaveLength(0)
  })

  it('denies viewers from creating reservations', async () => {
    const hospital = await approvedHospital()

    const { user: viewer } = await createStaffMember(
      hospital.hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const unit = await addUnit(hospital.hospitalProfileId)

    const res = await reserve(tokenFor(viewer), {
      bloodUnitId: unit.id,
    })

    expect(res.status).toBe(403)
  })
})
