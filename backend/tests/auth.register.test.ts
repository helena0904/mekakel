import request from 'supertest'
import bcrypt from 'bcrypt'

import { createApp } from './helpers/app'
import { prisma, resetDatabase, disconnectDatabase } from './helpers/db'
import {
  uniqueEmail,
  uniqueIp,
  MOCK_FAYDA,
  ageFromDob,
  TEST_PASSWORD,
} from './helpers/factories'

const app = createApp()

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

interface DonorFieldOverrides {
  [key: string]: string | undefined
}

function donorFields(
  overrides: DonorFieldOverrides = {},
  identityIndex = 0
): Record<string, string | undefined> {
  const identity = MOCK_FAYDA[identityIndex]

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
    availabilities: JSON.stringify([{ day: 'MONDAY', time: '09:00' }]),
    reportType: 'IMAGE',
    ...overrides,
  }
}

function postDonor(
  fields: Record<string, string | undefined>,
  options: {
    ip?: string
    attachFile?: boolean
    contentType?: string
    filename?: string
  } = {}
) {
  const req = request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', options.ip ?? uniqueIp())

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      req.field(key, value)
    }
  }

  if (options.attachFile !== false) {
    req.attach('medicalReport', PNG_BUFFER, {
      filename: options.filename ?? 'report.png',
      contentType: options.contentType ?? 'image/png',
    })
  }

  return req
}

function postHospital(
  fields: Record<string, string | undefined>,
  options: { ip?: string } = {}
) {
  const req = request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', options.ip ?? uniqueIp())

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      req.field(key, value)
    }
  }

  return req
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('POST /api/auth/register - individual donor', () => {
  it('registers a valid donor, hashes the password, and stores a pending profile', async () => {
    const fields = donorFields()

    const res = await postDonor(fields)

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      email: fields.email,
      role: 'DONOR',
      accountType: 'INDIVIDUAL',
      isActive: true,
    })

    const user = await prisma.user.findUnique({
      where: { email: fields.email! },
      include: {
        donorProfile: { include: { medicalReports: true } },
      },
    })

    expect(user).not.toBeNull()
    expect(user!.passwordHash).not.toBe(fields.password)
    await expect(
      bcrypt.compare(fields.password!, user!.passwordHash)
    ).resolves.toBe(true)

    expect(user!.donorProfile).not.toBeNull()
    expect(user!.donorProfile!.verificationStatus).toBe('PENDING')
    expect(user!.donorProfile!.faydaId).toBe(fields.faydaId)
    expect(user!.donorProfile!.medicalReports).toHaveLength(1)

    const welcome = await prisma.notification.findFirst({
      where: { userId: user!.id },
    })

    expect(welcome).toMatchObject({
      type: 'DONOR_REGISTERED',
      recipientEmail: fields.email,
      subject: 'Welcome to MEKAKEL',
    })
  })

  it('rejects missing required donor information (no age)', async () => {
    const fields = donorFields({ age: undefined })

    const res = await postDonor(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/missing required donor/i)
  })

  it('rejects a password that does not meet the strength policy', async () => {
    const fields = donorFields({ password: 'weakpass1' })

    const res = await postDonor(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid registration data/i)
  })

  it('rejects a malformed Fayda ID', async () => {
    const fields = donorFields({ faydaId: '12345' })

    const res = await postDonor(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid registration data/i)
  })

  it('rejects an age that does not match the date of birth', async () => {
    const fields = donorFields()
    const mismatchedAge = Number(fields.age) + 1
    const res = await postDonor({
      ...fields,
      age: String(mismatchedAge),
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/age must be at least 18/i)
  })

  it('rejects an underage donor', async () => {
    const year = new Date().getUTCFullYear() - 15
    const fields = donorFields({
      dateOfBirth: `${year}-01-01`,
      age: '15',
    })

    const res = await postDonor(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid registration data|at least 18/i)
  })

  it('rejects a last-donation date in the future', async () => {
    const fields = donorFields({ lastDonation: '2999-01-01' })

    const res = await postDonor(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cannot be in the future/i)
  })

  it('rejects a donor without a medical report', async () => {
    const fields = donorFields()

    const res = await postDonor(fields, { attachFile: false })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/upload a medical report/i)
  })

  it('rejects when the report type does not match the uploaded file', async () => {
    const fields = donorFields({ reportType: 'PDF' })

    const res = await postDonor(fields, { contentType: 'image/png' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/does not match/i)
  })

  it('rejects a duplicate email with 409', async () => {
    const first = donorFields()
    const firstRes = await postDonor(first)
    expect(firstRes.status).toBe(201)

    const second = donorFields({ email: first.email }, 1)
    const secondRes = await postDonor(second)

    expect(secondRes.status).toBe(409)
    expect(secondRes.body.message).toMatch(/already registered/i)
  })

  it('rejects a duplicate Mock Fayda identity with 409', async () => {
    const first = donorFields()
    const firstRes = await postDonor(first)
    expect(firstRes.status).toBe(201)

    const second = donorFields({ faydaId: first.faydaId })
    const secondRes = await postDonor(second)

    expect(secondRes.status).toBe(409)
    expect(secondRes.body.message).toMatch(/already registered/i)
  })
})

describe('POST /api/auth/register - clinical reviewer', () => {
  function doctorFields(
    overrides: DonorFieldOverrides = {}
  ): Record<string, string | undefined> {
    return {
      name: 'Dr. Test Reviewer',
      email: uniqueEmail('doctor'),
      password: TEST_PASSWORD,
      accountType: 'INDIVIDUAL',
      registrationType: 'DOCTOR',
      phone: '+251900000003',
      licenseNumber: `LIC-${Date.now()}-${Math.random()}`,
      specialization: 'Hematology',
      institution: 'Test General Hospital',
      ...overrides,
    }
  }

  it('registers an inactive clinical reviewer pending administrator approval', async () => {
    const fields = doctorFields()

    const res = await postHospital(fields)

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      email: fields.email,
      role: 'DOCTOR',
      accountType: 'INDIVIDUAL',
      isActive: false,
    })

    const user = await prisma.user.findUnique({
      where: { email: fields.email! },
      include: { doctorProfile: true },
    })

    expect(user).not.toBeNull()
    expect(user!.passwordHash).not.toBe(fields.password)
    expect(user!.doctorProfile).toMatchObject({
      licenseNumber: fields.licenseNumber,
      specialization: 'Hematology',
      institution: 'Test General Hospital',
      isVerified: false,
    })

    const welcome = await prisma.notification.findFirst({
      where: { userId: user!.id },
    })

    expect(welcome).toBeNull()
  })

  it('rejects a clinical reviewer without professional details', async () => {
    const fields = doctorFields({ licenseNumber: undefined })

    const res = await postHospital(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(
      /missing required clinical reviewer information/i
    )
  })

  it('rejects a clinical reviewer registration that uploads a medical report', async () => {
    const fields = doctorFields()

    const res = await postHospital(fields).attach(
      'medicalReport',
      PNG_BUFFER,
      { filename: 'report.png', contentType: 'image/png' }
    )

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(
      /cannot include a donor medical report/i
    )
  })
})

describe('POST /api/auth/register - hospital', () => {
  function hospitalFields(
    overrides: DonorFieldOverrides = {}
  ): Record<string, string | undefined> {
    return {
      name: 'Test Hospital',
      hospitalName: 'Test Hospital',
      email: uniqueEmail('hospital'),
      password: TEST_PASSWORD,
      accountType: 'HOSPITAL',
      phone: '+251900000002',
      address: 'Addis Ababa',
      ...overrides,
    }
  }

  it('registers a valid hospital as active and unverified', async () => {
    const fields = hospitalFields()

    const res = await postHospital(fields)

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      email: fields.email,
      role: 'HOSPITAL_STAFF',
      accountType: 'HOSPITAL',
      isActive: true,
    })

    const user = await prisma.user.findUnique({
      where: { email: fields.email! },
      include: { hospitalProfile: true },
    })

    expect(user!.passwordHash).not.toBe(fields.password)
    await expect(
      bcrypt.compare(fields.password!, user!.passwordHash)
    ).resolves.toBe(true)
    expect(user!.hospitalProfile).not.toBeNull()
    expect(user!.hospitalProfile!.isVerified).toBe(false)

    const welcome = await prisma.notification.findFirst({
      where: { userId: user!.id },
    })

    expect(welcome).toMatchObject({
      type: 'HOSPITAL_REGISTERED',
      recipientEmail: fields.email,
      subject: 'Welcome to MEKAKEL',
    })
  })

  it('rejects missing required hospital information', async () => {
    const fields = hospitalFields({ hospitalName: undefined })

    const res = await postHospital(fields)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/missing required hospital/i)
  })

  it('rejects a hospital registration that uploads a donor medical report', async () => {
    const fields = hospitalFields()

    const res = await postHospital(fields).attach(
      'medicalReport',
      PNG_BUFFER,
      { filename: 'report.png', contentType: 'image/png' }
    )

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cannot include a donor medical report/i)
  })

  it('rejects a duplicate hospital email with 409', async () => {
    const first = hospitalFields()
    expect((await postHospital(first)).status).toBe(201)

    const second = hospitalFields({ email: first.email })
    const res = await postHospital(second)

    expect(res.status).toBe(409)
  })
})
