import request from 'supertest'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  createStaffMember,
  createUser,
} from './helpers/factories'
import {
  addUnit,
  approvedHospital,
  auth,
  isoDate,
  tokenFor,
} from './helpers/actors'

const app = createApp()

function createUnitBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    bagId: `BAG-API-${Math.random().toString(16).slice(2, 8)}`,
    bloodType: 'O_NEGATIVE',
    component: 'RED_CELLS',
    collectionDate: isoDate(-5),
    expiryDate: isoDate(30),
    ...overrides,
  }
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('inventory screening restrictions', () => {
  it('hides unscreened units from available stock until both checks pass', async () => {
    const hospital = await approvedHospital()

    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospital.token))
      .send(createUnitBody())

    expect(created.status).toBe(201)
    expect(created.body.unit.screeningStatus).toBe('PENDING')
    expect(created.body.unit.isAvailable).toBe(false)

    const availableOnly = await request(app)
      .get('/api/inventory?availability=available')
      .set('Authorization', auth(hospital.token))

    expect(availableOnly.body.units).toHaveLength(0)

    const promoted = await request(app)
      .put(`/api/inventory/${created.body.unit.id}`)
      .set('Authorization', auth(hospital.token))
      .send({
        screeningStatus: 'PASSED',
        confirmationStatus: 'CONFIRMED',
      })

    expect(promoted.status).toBe(200)
    expect(promoted.body.unit.screeningStatus).toBe('PASSED')
    expect(promoted.body.unit.confirmationStatus).toBe(
      'CONFIRMED'
    )
    expect(promoted.body.unit.isAvailable).toBe(true)

    const nowAvailable = await request(app)
      .get('/api/inventory?availability=available')
      .set('Authorization', auth(hospital.token))

    expect(nowAvailable.body.units).toHaveLength(1)
  })

  it('counts pending screening and confirmation in the summary', async () => {
    const hospital = await approvedHospital()

    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      screeningStatus: 'PENDING',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      confirmationStatus: 'PENDING',
    })

    const res = await request(app)
      .get('/api/inventory/summary')
      .set('Authorization', auth(hospital.token))

    expect(res.status).toBe(200)

    const type = res.body.summary.types.find(
      (entry: { bloodType: string }) =>
        entry.bloodType === 'O_NEGATIVE'
    )

    expect(type.totalUnits).toBe(3)
    expect(type.availableUnits).toBe(1)
    expect(type.pendingScreening).toBe(1)
    expect(type.pendingConfirmation).toBe(1)
    expect(res.body.summary.totals.totalUnits).toBe(3)
  })
})

describe('inventory expiry enforcement', () => {
  it('flags expired units and excludes them from available stock', async () => {
    const hospital = await approvedHospital()

    const expired = await addUnit(hospital.hospitalProfileId, {
      collectionDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })

    const res = await request(app)
      .get(`/api/inventory/${expired.id}`)
      .set('Authorization', auth(hospital.token))

    expect(res.status).toBe(200)
    expect(res.body.unit.isExpired).toBe(true)
    expect(res.body.unit.isAvailable).toBe(false)

    const summary = await request(app)
      .get('/api/inventory/summary')
      .set('Authorization', auth(hospital.token))

    const type = summary.body.summary.types.find(
      (entry: { bloodType: string }) =>
        entry.bloodType === 'O_NEGATIVE'
    )

    expect(type.expiredUnits).toBe(1)
  })

  it('reports EXPIRED and EXPIRING_SOON alerts and ignores used/discarded units', async () => {
    const hospital = await approvedHospital()

    await addUnit(hospital.hospitalProfileId, {
      collectionDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    await addUnit(hospital.hospitalProfileId, {
      expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    })
    await addUnit(hospital.hospitalProfileId, {
      status: 'USED',
      expiryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    })

    const res = await request(app)
      .get('/api/inventory/alerts?withinDays=7')
      .set('Authorization', auth(hospital.token))

    expect(res.status).toBe(200)
    expect(res.body.alerts).toHaveLength(2)

    const statuses = res.body.alerts.map(
      (alert: { status: string }) => alert.status
    )

    expect(statuses).toContain('EXPIRED')
    expect(statuses).toContain('EXPIRING_SOON')
  })

  it('rejects expiry dates before the collection date', async () => {
    const hospital = await approvedHospital()

    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospital.token))
      .send(
        createUnitBody({
          collectionDate: isoDate(-1),
          expiryDate: isoDate(-5),
        })
      )

    expect(created.status).toBe(400)

    const unit = await addUnit(hospital.hospitalProfileId)

    const updated = await request(app)
      .put(`/api/inventory/${unit.id}`)
      .set('Authorization', auth(hospital.token))
      .send({
        collectionDate: isoDate(0),
        expiryDate: isoDate(-3),
      })

    expect(updated.status).toBe(400)
    expect(updated.body.message).toMatch(/after collection/i)
  })

  it('rejects an invalid expiry window', async () => {
    const hospital = await approvedHospital()

    const res = await request(app)
      .get('/api/inventory/alerts?withinDays=999')
      .set('Authorization', auth(hospital.token))

    expect(res.status).toBe(400)
  })
})

describe('inventory data isolation', () => {
  it('never exposes another hospital inventory', async () => {
    const hospitalA = await approvedHospital()
    const hospitalB = await approvedHospital()

    const unit = await addUnit(hospitalA.hospitalProfileId, {
      bagId: 'ISOLATED-BAG',
    })

    const listB = await request(app)
      .get('/api/inventory')
      .set('Authorization', auth(hospitalB.token))

    expect(listB.status).toBe(200)
    expect(listB.body.units).toHaveLength(0)

    const readB = await request(app)
      .get(`/api/inventory/${unit.id}`)
      .set('Authorization', auth(hospitalB.token))

    expect(readB.status).toBe(404)

    const updateB = await request(app)
      .put(`/api/inventory/${unit.id}`)
      .set('Authorization', auth(hospitalB.token))
      .send({ storageLocation: 'Stolen' })

    expect(updateB.status).toBe(404)

    const deleteB = await request(app)
      .delete(`/api/inventory/${unit.id}`)
      .set('Authorization', auth(hospitalB.token))

    expect(deleteB.status).toBe(404)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.hospitalProfileId).toBe(
      hospitalA.hospitalProfileId
    )
    expect(stored?.storageLocation).toBe('Fridge A')
  })
})

describe('inventory role enforcement', () => {
  it('lets viewers read but not modify inventory', async () => {
    const hospital = await approvedHospital()

    const { user: viewer } = await createStaffMember(
      hospital.hospitalProfileId,
      { staffRole: 'VIEWER' }
    )

    const viewerToken = tokenFor(viewer)

    const listed = await request(app)
      .get('/api/inventory')
      .set('Authorization', auth(viewerToken))

    expect(listed.status).toBe(200)

    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(viewerToken))
      .send(createUnitBody())

    expect(created.status).toBe(403)

    const unit = await addUnit(hospital.hospitalProfileId)

    const updated = await request(app)
      .put(`/api/inventory/${unit.id}`)
      .set('Authorization', auth(viewerToken))
      .send({ storageLocation: 'Fridge B' })

    expect(updated.status).toBe(403)

    const removed = await request(app)
      .delete(`/api/inventory/${unit.id}`)
      .set('Authorization', auth(viewerToken))

    expect(removed.status).toBe(403)
  })

  it('blocks hospitals that are not yet approved', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })

    const listed = await request(app)
      .get('/api/inventory')
      .set('Authorization', auth(tokenFor(user)))

    expect(listed.status).toBe(403)

    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(tokenFor(user)))
      .send(createUnitBody())

    expect(created.status).toBe(403)
  })

  it('blocks hospitals whose approval was suspended', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: true,
      hospitalStatus: 'SUSPENDED',
    })

    const listed = await request(app)
      .get('/api/inventory')
      .set('Authorization', auth(tokenFor(user)))

    expect(listed.status).toBe(403)
  })

  it('rejects duplicate bag identifiers within a hospital', async () => {
    const hospital = await approvedHospital()

    const body = createUnitBody({ bagId: 'DUPLICATE-BAG' })

    const first = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospital.token))
      .send(body)

    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospital.token))
      .send(body)

    expect(second.status).toBe(409)
  })

  it('creates multiple shareable units with numbered bag identifiers', async () => {
    const hospital = await approvedHospital()

    const created = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospital.token))
      .send(createUnitBody({ bagId: 'BG-101', quantity: 3 }))

    expect(created.status).toBe(201)
    expect(created.body.units).toHaveLength(3)
    expect(created.body.unit.bagId).toBe('BG-101-1')
    expect(
      created.body.units.map(
        (unit: { bagId: string }) => unit.bagId
      )
    ).toEqual(['BG-101-1', 'BG-101-2', 'BG-101-3'])

    const listed = await request(app)
      .get('/api/inventory')
      .set('Authorization', auth(hospital.token))

    expect(listed.body.units).toHaveLength(3)
  })

  it('rejects a quantity outside the supported range', async () => {
    const hospital = await approvedHospital()

    const response = await request(app)
      .post('/api/inventory')
      .set('Authorization', auth(hospital.token))
      .send(createUnitBody({ quantity: 0 }))

    expect(response.status).toBe(400)
  })
})
