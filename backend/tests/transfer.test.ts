import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import { createUser } from './helpers/factories'

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

async function addUnit(
  hospitalProfileId: number,
  overrides: {
    expiryDate?: Date
    status?: string
    screeningStatus?: string
  } = {}
) {
  return prisma.bloodUnit.create({
    data: {
      hospitalProfileId,
      bagId: `BAG-${randomUUID().slice(0, 8)}`,
      bloodType: 'O_NEGATIVE',
      component: 'RED_CELLS',
      collectionDate: new Date(Date.now() - 5 * DAY),
      expiryDate:
        overrides.expiryDate ?? new Date(Date.now() + 30 * DAY),
      screeningStatus: (overrides.screeningStatus ??
        'PASSED') as never,
      confirmationStatus: 'CONFIRMED',
      bloodTypeConfirmed: true,
      status: (overrides.status ?? 'AVAILABLE') as never,
    },
  })
}

async function createTransfer(
  source: Awaited<ReturnType<typeof approvedHospital>>,
  unitId: number,
  toHospitalProfileId: number,
  overrides: Record<string, unknown> = {}
) {
  return request(app)
    .post('/api/transfers')
    .set('Authorization', auth(source.token))
    .send({
      bloodUnitId: unitId,
      toHospitalProfileId,
      ...overrides,
    })
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('transfer creation', () => {
  it('locks an available unit and records the first event', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const res = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )

    expect(res.status).toBe(201)
    expect(res.body.transfer.status).toBe('REQUESTED')
    expect(res.body.transfer.events).toHaveLength(1)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('RESERVED')
  })

  it('rejects a transfer to the same hospital', async () => {
    const source = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const res = await createTransfer(
      source,
      unit.id,
      source.hospitalProfileId
    )

    expect(res.status).toBe(400)
  })

  it('blocks unapproved source hospitals from creating transfers', async () => {
    const { user: pending } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })
    const destination = await approvedHospital()
    const unit = await addUnit(pending.hospitalProfile!.id)

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', auth(tokenFor(pending)))
      .send({
        bloodUnitId: unit.id,
        toHospitalProfileId: destination.hospitalProfileId,
      })

    expect(res.status).toBe(403)
  })

  it('rejects an unapproved destination hospital', async () => {
    const source = await approvedHospital()
    const { user: pending } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })
    const unit = await addUnit(source.hospitalProfileId)

    const res = await createTransfer(
      source,
      unit.id,
      pending.hospitalProfile!.id
    )

    expect(res.status).toBe(409)
  })
})

describe('transfer lifecycle', () => {
  it('approves, dispatches, receives and completes a transfer', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )

    const transferId = created.body.transfer.id

    const approved = await request(app)
      .post(`/api/transfers/${transferId}/approve`)
      .set('Authorization', auth(destination.token))
      .send({ note: 'Accepted' })

    expect(approved.status).toBe(200)
    expect(approved.body.transfer.status).toBe('APPROVED')

    const dispatched = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', auth(source.token))
      .send({})

    expect(dispatched.status).toBe(200)
    expect(dispatched.body.transfer.status).toBe('DISPATCHED')

    const received = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', auth(destination.token))
      .send({})

    expect(received.status).toBe(200)
    expect(received.body.transfer.status).toBe('RECEIVED')

    const completed = await request(app)
      .post(`/api/transfers/${transferId}/complete`)
      .set('Authorization', auth(destination.token))
      .send({})

    expect(completed.status).toBe(200)
    expect(completed.body.transfer.status).toBe('COMPLETED')
    expect(completed.body.transfer.events).toHaveLength(5)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.hospitalProfileId).toBe(
      destination.hospitalProfileId
    )
    expect(stored?.status).toBe('AVAILABLE')
  })

  it('preserves an ordered audit trail of status changes', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )
    const transferId = created.body.transfer.id

    await request(app)
      .post(`/api/transfers/${transferId}/approve`)
      .set('Authorization', auth(destination.token))
      .send({})

    const detail = await request(app)
      .get(`/api/transfers/${transferId}`)
      .set('Authorization', auth(source.token))

    expect(detail.status).toBe(200)

    const statuses = detail.body.transfer.events.map(
      (event: { toStatus: string }) => event.toStatus
    )

    expect(statuses).toEqual(['REQUESTED', 'APPROVED'])
  })

  it('rejection returns the unit to available stock', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )

    const rejected = await request(app)
      .post(`/api/transfers/${created.body.transfer.id}/reject`)
      .set('Authorization', auth(destination.token))
      .send({ reason: 'No capacity' })

    expect(rejected.status).toBe(200)
    expect(rejected.body.transfer.status).toBe('REJECTED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')
  })

  it('cancellation before dispatch returns the unit to available', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )

    const cancelled = await request(app)
      .post(`/api/transfers/${created.body.transfer.id}/cancel`)
      .set('Authorization', auth(source.token))
      .send({})

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.transfer.status).toBe('CANCELLED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')
  })

  it('marks a unit that expired by the time it is completed as EXPIRED', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )
    const transferId = created.body.transfer.id

    await request(app)
      .post(`/api/transfers/${transferId}/approve`)
      .set('Authorization', auth(destination.token))
      .send({})
    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', auth(source.token))
      .send({})
    await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', auth(destination.token))
      .send({})

    await prisma.bloodUnit.update({
      where: { id: unit.id },
      data: { expiryDate: new Date(Date.now() - DAY) },
    })

    const completed = await request(app)
      .post(`/api/transfers/${transferId}/complete`)
      .set('Authorization', auth(destination.token))
      .send({})

    expect(completed.status).toBe(200)

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('EXPIRED')
    expect(stored?.hospitalProfileId).toBe(
      destination.hospitalProfileId
    )
  })
})

describe('transfer authorization', () => {
  it('lets only the destination approve', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )

    const bySource = await request(app)
      .post(`/api/transfers/${created.body.transfer.id}/approve`)
      .set('Authorization', auth(source.token))
      .send({})

    expect(bySource.status).toBe(404)
  })

  it('hides transfers from unrelated hospitals', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const outsider = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId
    )

    const res = await request(app)
      .get(`/api/transfers/${created.body.transfer.id}`)
      .set('Authorization', auth(outsider.token))

    expect(res.status).toBe(404)
  })

  it('lists approved destination hospitals except the caller', async () => {
    const source = await approvedHospital()
    await approvedHospital()
    await approvedHospital()

    const res = await request(app)
      .get('/api/transfers/destinations')
      .set('Authorization', auth(source.token))

    expect(res.status).toBe(200)
    expect(res.body.hospitals).toHaveLength(2)
    expect(
      res.body.hospitals.every(
        (hospital: { id: number }) =>
          hospital.id !== source.hospitalProfileId
      )
    ).toBe(true)
  })
})

describe('transfer with a linked reservation', () => {
  it('consumes the reservation when the transfer completes', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const reserved = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(source.token))
      .send({ bloodUnitId: unit.id })

    expect(reserved.status).toBe(201)

    const created = await createTransfer(
      source,
      unit.id,
      destination.hospitalProfileId,
      { reservationId: reserved.body.reservation.id }
    )

    expect(created.status).toBe(201)

    const transferId = created.body.transfer.id

    await request(app)
      .post(`/api/transfers/${transferId}/approve`)
      .set('Authorization', auth(destination.token))
      .send({})
    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', auth(source.token))
      .send({})
    await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', auth(destination.token))
      .send({})
    const completed = await request(app)
      .post(`/api/transfers/${transferId}/complete`)
      .set('Authorization', auth(destination.token))
      .send({})

    expect(completed.status).toBe(200)

    const reservation = await prisma.reservation.findUnique({
      where: { id: reserved.body.reservation.id },
    })

    expect(reservation?.status).toBe('CONSUMED')

    const stored = await prisma.bloodUnit.findUnique({
      where: { id: unit.id },
    })

    expect(stored?.status).toBe('AVAILABLE')
    expect(stored?.hospitalProfileId).toBe(
      destination.hospitalProfileId
    )
  })
})
