import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  createDonorProfile,
  createUser,
} from './helpers/factories'
import { assignDoctorReview } from './helpers/actors'
import { REPORT_DIR } from '../src/middleware/upload.middleware'
import { compatibleDonorTypes } from '../src/services/compatibility.service'
import {
  getCompatibilityConfig,
  updateSettings,
} from '../src/services/settings.service'

const app = createApp()

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

async function adminUser() {
  const { user } = await createUser({ role: 'ADMIN' })

  return { user, token: tokenFor(user) }
}

async function doctorUser() {
  const { user } = await createUser({ role: 'DOCTOR' })

  return { user, token: tokenFor(user) }
}

async function donorWithReport() {
  const { user } = await createUser({})
  const profile = await createDonorProfile(user.id)
  const report = await prisma.medicalReport.create({
    data: {
      donorProfileId: profile.id,
      uploadedByUserId: user.id,
      reportType: 'PDF',
      fileUrl: `${randomUUID()}.pdf`,
      verificationStatus: 'PENDING',
    },
  })

  return { user, token: tokenFor(user), profile, report }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnectDatabase()
})

describe('Phase 7 authorization', () => {
  it('rejects anonymous access to admin routes', async () => {
    const response = await request(app).get('/api/admin/users')

    expect(response.status).toBe(401)
  })

  it('rejects donors from admin routes', async () => {
    const donor = await donorWithReport()

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', auth(donor.token))

    expect(response.status).toBe(403)
  })

  it('rejects admins from doctor routes', async () => {
    const admin = await adminUser()

    const response = await request(app)
      .get('/api/doctor/verifications')
      .set('Authorization', auth(admin.token))

    expect(response.status).toBe(403)
  })

  it('allows admins to list users', async () => {
    const admin = await adminUser()

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', auth(admin.token))

    expect(response.status).toBe(200)
    expect(response.body.users).toHaveLength(1)
    expect(response.body.users[0].role).toBe('ADMIN')
  })
})

describe('Doctor verification workflow', () => {
  it('lists and reviews donor verifications with an audit trail', async () => {
    const donor = await donorWithReport()
    const doctor = await doctorUser()

    await assignDoctorReview(donor.profile.id, doctor.user.id)

    const queue = await request(app)
      .get('/api/doctor/verifications')
      .set('Authorization', auth(doctor.token))

    expect(queue.status).toBe(200)
    expect(
      queue.body.donors.map((entry: { id: number }) => entry.id)
    ).toContain(donor.profile.id)

    const detail = await request(app)
      .get(`/api/doctor/verifications/${donor.profile.id}`)
      .set('Authorization', auth(doctor.token))

    expect(detail.status).toBe(200)
    expect(detail.body.donor.id).toBe(donor.profile.id)
    expect(detail.body.eligibility).toBeDefined()

    const decision = await request(app)
      .post(
        `/api/doctor/verifications/${donor.profile.id}/decision`
      )
      .set('Authorization', auth(doctor.token))
      .send({ decision: 'VERIFY' })

    expect(decision.status).toBe(200)
    expect(decision.body.donor.verificationStatus).toBe('VERIFIED')

    const profile = await prisma.donorProfile.findUnique({
      where: { id: donor.profile.id },
    })
    expect(profile?.verificationStatus).toBe('VERIFIED')

    const report = await prisma.medicalReport.findUnique({
      where: { id: donor.report.id },
    })
    expect(report?.verificationStatus).toBe('VERIFIED')

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'DONOR_VERIFICATION_DECIDED',
        entityId: donor.profile.id,
      },
    })
    expect(audit).not.toBeNull()
    expect(audit?.actorUserId).toBe(doctor.user.id)

    const admin = await adminUser()

    const logs = await request(app)
      .get('/api/admin/audit-logs')
      .query({ action: 'DONOR_VERIFICATION_DECIDED' })
      .set('Authorization', auth(admin.token))

    expect(logs.status).toBe(200)
    expect(logs.body.logs).toHaveLength(1)
  })

  it('requires a reason to reject a donor', async () => {
    const donor = await donorWithReport()
    const doctor = await doctorUser()

    await assignDoctorReview(donor.profile.id, doctor.user.id)

    const response = await request(app)
      .post(
        `/api/doctor/verifications/${donor.profile.id}/decision`
      )
      .set('Authorization', auth(doctor.token))
      .send({ decision: 'REJECT' })

    expect(response.status).toBe(400)
  })

  it('streams medical report files to doctors', async () => {
    const donor = await donorWithReport()
    const doctor = await doctorUser()

    await assignDoctorReview(donor.profile.id, doctor.user.id)

    const filename = path.basename(donor.report.fileUrl)
    const filePath = path.join(REPORT_DIR, filename)

    writeFileSync(filePath, 'report-contents')

    try {
      const response = await request(app)
        .get(`/api/doctor/reports/${donor.report.id}/file`)
        .set('Authorization', auth(doctor.token))

      expect(response.status).toBe(200)
    } finally {
      unlinkSync(filePath)
    }
  })
})

describe('Admin hospital approvals', () => {
  it('approves a hospital and records an audit entry', async () => {
    const admin = await adminUser()
    const { user: hospitalUser } = await createUser({
      accountType: 'HOSPITAL',
    })
    const hospitalProfileId = hospitalUser.hospitalProfile!.id

    const response = await request(app)
      .post(`/api/admin/hospitals/${hospitalProfileId}/review`)
      .set('Authorization', auth(admin.token))
      .send({ decision: 'APPROVE' })

    expect(response.status).toBe(200)
    expect(response.body.hospital.status).toBe('APPROVED')

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'HOSPITAL_REGISTRATION_DECIDED',
        entityId: hospitalProfileId,
      },
    })
    expect(audit).not.toBeNull()
  })

  it('requires a reason to reject a hospital', async () => {
    const admin = await adminUser()
    const { user: hospitalUser } = await createUser({
      accountType: 'HOSPITAL',
    })

    const response = await request(app)
      .post(
        `/api/admin/hospitals/${hospitalUser.hospitalProfile!.id}/review`
      )
      .set('Authorization', auth(admin.token))
      .send({ decision: 'REJECT' })

    expect(response.status).toBe(400)
  })
})

describe('Admin user management', () => {
  it('changes a user role and audits it', async () => {
    const admin = await adminUser()
    const target = await donorWithReport()

    const response = await request(app)
      .patch(`/api/admin/users/${target.user.id}`)
      .set('Authorization', auth(admin.token))
      .send({ role: 'DOCTOR' })

    expect(response.status).toBe(200)
    expect(response.body.user.role).toBe('DOCTOR')

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_ROLE_CHANGED',
        entityId: target.user.id,
      },
    })
    expect(audit).not.toBeNull()
  })

  it('prevents an admin from deactivating their own account', async () => {
    const admin = await adminUser()

    const response = await request(app)
      .patch(`/api/admin/users/${admin.user.id}`)
      .set('Authorization', auth(admin.token))
      .send({ isActive: false })

    expect(response.status).toBe(400)
  })
})

describe('Governance settings', () => {
  it('returns defaults, applies updates and audits them', async () => {
    const admin = await adminUser()

    const initial = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', auth(admin.token))

    expect(initial.status).toBe(200)
    expect(initial.body.settings.eligibility.minAge).toBe(18)
    expect(initial.body.settings.compatibility.enforceRh).toBe(
      true
    )

    const update = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', auth(admin.token))
      .send({
        eligibility: { minAge: 21 },
        compatibility: { enforceRh: false },
      })

    expect(update.status).toBe(200)
    expect(update.body.settings.eligibility.minAge).toBe(21)
    expect(update.body.settings.compatibility.enforceRh).toBe(
      false
    )

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SETTINGS_UPDATED' },
    })
    expect(audit).not.toBeNull()
  })

  it('applies eligibility thresholds to donor screening', async () => {
    const admin = await adminUser()

    await request(app)
      .put('/api/admin/settings')
      .set('Authorization', auth(admin.token))
      .send({ eligibility: { minAge: 90, maxAge: 95 } })

    const donor = await donorWithReport()

    const dashboard = await request(app)
      .get('/api/donor/dashboard')
      .set('Authorization', auth(donor.token))

    expect(dashboard.status).toBe(200)

    const ageCheck = dashboard.body.eligibility.checks.find(
      (check: { key: string }) => check.key === 'age'
    )
    expect(ageCheck.label).toBe('Age between 90 and 95')
    expect(ageCheck.passed).toBe(false)
  })

  it('applies compatibility policy to matching rules', async () => {
    expect(
      compatibleDonorTypes('A_NEGATIVE', 'RED_CELLS')
    ).toEqual(['A_NEGATIVE', 'O_NEGATIVE'])

    await updateSettings({ compatibility: { enforceRh: false } })

    const config = await getCompatibilityConfig()
    const relaxed = compatibleDonorTypes(
      'A_NEGATIVE',
      'RED_CELLS',
      config
    )

    expect(relaxed).toContain('A_POSITIVE')
    expect(relaxed).toContain('O_POSITIVE')
  })
})
