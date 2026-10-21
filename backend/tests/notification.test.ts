import request from 'supertest'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { randomUUID } from 'node:crypto'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  createUser,
  uniqueEmail,
  uniqueIp,
  MOCK_FAYDA,
  ageFromDob,
  TEST_PASSWORD,
} from './helpers/factories'
import {
  deliverNotification,
  processPendingNotifications,
  queueNotification,
  updatePreferences,
} from '../src/services/notification.service'

const app = createApp()

const DAY = 24 * 60 * 60 * 1000

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

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

interface TokenUser {
  id: number
  role: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

function tokenFor(user: TokenUser): string {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      accountType: user.accountType,
      passwordVersion: 0,
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

function addUnit(hospitalProfileId: number) {
  return prisma.bloodUnit.create({
    data: {
      hospitalProfileId,
      bagId: `BAG-${randomUUID().slice(0, 8)}`,
      bloodType: 'O_NEGATIVE',
      component: 'RED_CELLS',
      collectionDate: new Date(Date.now() - 5 * DAY),
      expiryDate: new Date(Date.now() + 30 * DAY),
      screeningStatus: 'PASSED',
      confirmationStatus: 'CONFIRMED',
      bloodTypeConfirmed: true,
      status: 'AVAILABLE',
    },
  })
}

function donorFields() {
  const identity = MOCK_FAYDA[0]

  return {
    name: identity.fullName,
    email: uniqueEmail('donor'),
    password: TEST_PASSWORD,
    accountType: 'INDIVIDUAL',
    faydaId: identity.faydaId,
    dateOfBirth: identity.dateOfBirth,
    phone: '+251900000001',
    address: 'Addis Ababa',
    age: String(ageFromDob(identity.dateOfBirth)),
    weight: '70',
    height: '175',
    currentAvailability: 'AVAILABLE',
    availabilities: JSON.stringify([
      { day: 'MONDAY', time: '09:00' },
    ]),
    reportType: 'IMAGE',
  }
}

function postDonor(
  fields: Record<string, string | undefined>
) {
  const req = request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', uniqueIp())

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      req.field(key, value)
    }
  }

  req.attach('medicalReport', PNG_BUFFER, {
    filename: 'report.png',
    contentType: 'image/png',
  })

  return req
}

describe('notification queue', () => {
  it('queues a pending notification with rendered content', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    const notification = await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
    })

    expect(notification).not.toBeNull()
    expect(notification!.status).toBe('PENDING')
    expect(notification!.category).toBe('DONOR')
    expect(notification!.recipientEmail).toBe(user.email)
    expect(notification!.subject).toMatch(/welcome/i)
    expect(notification!.body).toContain(user.name)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('suppresses delivery when the category is disabled', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    await updatePreferences(user.id, { donorUpdates: false })

    const notification = await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
    })

    expect(notification!.status).toBe('SUPPRESSED')

    const result = await processPendingNotifications()

    expect(result.processed).toBe(0)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('deduplicates notifications that share a dedupe key', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    const first = await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
      dedupeKey: 'donor-registered',
    })

    const second = await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
      dedupeKey: 'donor-registered',
    })

    expect(second!.id).toBe(first!.id)
    expect(await prisma.notification.count()).toBe(1)
  })
})

describe('notification delivery', () => {
  it('delivers due notifications and marks them sent', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
    })

    const result = await processPendingNotifications()

    expect(result).toMatchObject({
      processed: 1,
      sent: 1,
      failed: 0,
    })

    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0][0].to).toBe(user.email)

    const stored = await prisma.notification.findFirstOrThrow()

    expect(stored.status).toBe('SENT')
    expect(stored.sentAt).not.toBeNull()
    expect(stored.attempts).toBe(1)
  })

  it('retries failed deliveries, then marks them failed', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })

    const notification = await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
      maxAttempts: 2,
    })

    sendMailMock.mockRejectedValueOnce(new Error('SMTP down'))
    const first = await deliverNotification(notification!.id)

    expect(first).toMatchObject({
      status: 'PENDING',
      attempts: 1,
    })

    sendMailMock.mockRejectedValueOnce(new Error('SMTP down'))
    const second = await deliverNotification(notification!.id)

    expect(second).toMatchObject({
      status: 'FAILED',
      attempts: 2,
    })

    const stored = await prisma.notification.findUniqueOrThrow(
      { where: { id: notification!.id } }
    )

    expect(stored.status).toBe('FAILED')
    expect(stored.lastError).toContain('SMTP down')
  })
})

describe('notifications API', () => {
  it('lists the current user notifications and marks them read', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })
    const token = tokenFor(user)

    await queueNotification({
      userId: user.id,
      type: 'DONOR_REGISTERED',
    })

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', auth(token))

    expect(list.status).toBe(200)
    expect(list.body.notifications).toHaveLength(1)
    expect(list.body.unreadCount).toBe(1)

    const id = list.body.notifications[0].id

    const read = await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set('Authorization', auth(token))

    expect(read.status).toBe(200)
    expect(read.body.notification.readAt).not.toBeNull()

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', auth(token))

    expect(count.body.unreadCount).toBe(0)
  })

  it('does not expose another user notifications', async () => {
    const a = await createUser({ accountType: 'INDIVIDUAL' })
    const b = await createUser({ accountType: 'INDIVIDUAL' })

    const notification = await queueNotification({
      userId: a.user.id,
      type: 'DONOR_REGISTERED',
    })

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', auth(tokenFor(b.user)))

    expect(list.body.notifications).toHaveLength(0)

    const read = await request(app)
      .patch(`/api/notifications/${notification!.id}/read`)
      .set('Authorization', auth(tokenFor(b.user)))

    expect(read.status).toBe(404)
  })

  it('reads and updates notification preferences', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
    })
    const token = tokenFor(user)

    const initial = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', auth(token))

    expect(initial.status).toBe(200)
    expect(initial.body.preferences).toEqual({
      emailEnabled: true,
      donorUpdates: true,
      hospitalUpdates: true,
      reservationUpdates: true,
      transferUpdates: true,
    })

    const updated = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', auth(token))
      .send({ transferUpdates: false })

    expect(updated.status).toBe(200)
    expect(updated.body.preferences.transferUpdates).toBe(false)
    expect(updated.body.preferences.donorUpdates).toBe(true)
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(401)
  })
})

describe('workflow notification hooks', () => {
  it('notifies a donor when they register', async () => {
    const fields = donorFields()

    const res = await postDonor(fields)

    expect(res.status).toBe(201)

    const stored = await prisma.notification.findFirst({
      where: { type: 'DONOR_REGISTERED' },
    })

    expect(stored).not.toBeNull()
    expect(stored!.recipientEmail).toBe(fields.email)
  })

  it('notifies a donor when an admin verifies them', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      role: 'DONOR',
    })

    const donorProfile = await prisma.donorProfile.create({
      data: {
        userId: user.id,
        phone: '+251900000000',
        address: 'Addis Ababa',
        age: 25,
        weight: 70,
        height: 175,
      },
    })

    const admin = await createUser({
      accountType: 'INDIVIDUAL',
      role: 'ADMIN',
    })

    const res = await request(app)
      .patch(
        `/api/donor/registrations/${donorProfile.id}/verification`
      )
      .set('Authorization', auth(tokenFor(admin.user)))
      .send({ decision: 'VERIFY' })

    expect(res.status).toBe(200)

    const stored = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'DONOR_VERIFICATION_APPROVED',
      },
    })

    expect(stored).not.toBeNull()
  })

  it('rejects donor review from a non-admin', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      role: 'DONOR',
    })

    const donorProfile = await prisma.donorProfile.create({
      data: {
        userId: user.id,
        phone: '+251900000000',
        address: 'Addis Ababa',
        age: 25,
        weight: 70,
        height: 175,
      },
    })

    const res = await request(app)
      .patch(
        `/api/donor/registrations/${donorProfile.id}/verification`
      )
      .set('Authorization', auth(tokenFor(user)))
      .send({ decision: 'VERIFY' })

    expect(res.status).toBe(403)
  })

  it('notifies a hospital owner when their registration is approved', async () => {
    const hospital = await createUser({
      accountType: 'HOSPITAL',
    })

    const admin = await createUser({
      accountType: 'INDIVIDUAL',
      role: 'ADMIN',
    })

    const res = await request(app)
      .post(
        `/api/hospital/admin/hospitals/${hospital.user.hospitalProfile!.id}/review`
      )
      .set('Authorization', auth(tokenFor(admin.user)))
      .send({ decision: 'APPROVE' })

    expect(res.status).toBe(200)

    const stored = await prisma.notification.findFirst({
      where: {
        userId: hospital.user.id,
        type: 'HOSPITAL_APPROVED',
      },
    })

    expect(stored).not.toBeNull()
  })

  it('notifies the reserving hospital when a reservation is cancelled', async () => {
    const hospital = await approvedHospital()
    const unit = await addUnit(hospital.hospitalProfileId)

    const created = await request(app)
      .post('/api/reservations')
      .set('Authorization', auth(hospital.token))
      .send({ bloodUnitId: unit.id })

    expect(created.status).toBe(201)

    const reservationId = created.body.reservation.id

    const cancelled = await request(app)
      .post(`/api/reservations/${reservationId}/cancel`)
      .set('Authorization', auth(hospital.token))
      .send({ reason: 'No longer needed' })

    expect(cancelled.status).toBe(200)

    const stored = await prisma.notification.findFirst({
      where: {
        userId: hospital.user.id,
        type: 'RESERVATION_CANCELLED',
      },
    })

    expect(stored).not.toBeNull()
  })

  it('notifies the destination hospital when a transfer is requested', async () => {
    const source = await approvedHospital()
    const destination = await approvedHospital()
    const unit = await addUnit(source.hospitalProfileId)

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', auth(source.token))
      .send({
        bloodUnitId: unit.id,
        toHospitalProfileId: destination.hospitalProfileId,
      })

    expect(res.status).toBe(201)

    const stored = await prisma.notification.findFirst({
      where: {
        userId: destination.user.id,
        type: 'TRANSFER_REQUESTED',
      },
    })

    expect(stored).not.toBeNull()
  })
})
