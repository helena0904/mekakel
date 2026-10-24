import request from 'supertest'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  acceptedDonorReservation,
  addDonor,
  adminUser,
  approvedHospital,
  assignDoctorReview,
  auth,
  doctorUser,
  tokenFor,
} from './helpers/actors'
import { createUser } from './helpers/factories'
import { REPORT_DIR } from '../src/middleware/upload.middleware'

const app = createApp()

const reportFiles: string[] = []

afterEach(() => {
  for (const file of reportFiles.splice(0)) {
    if (existsSync(file)) {
      unlinkSync(file)
    }
  }
})

async function donorWithReport(
  overrides: Parameters<typeof addDonor>[0] = {}
) {
  const donor = await addDonor({
    verificationStatus: 'PENDING',
    ...overrides,
  })

  const fileUrl = `${randomUUID()}.pdf`
  const filePath = path.join(REPORT_DIR, fileUrl)
  writeFileSync(filePath, 'report-contents')
  reportFiles.push(filePath)

  const report = await prisma.medicalReport.create({
    data: {
      donorProfileId: donor.id,
      uploadedByUserId: donor.userId,
      reportType: 'PDF',
      fileUrl,
      verificationStatus: 'PENDING',
    },
  })

  return { donor, report }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await disconnectDatabase()
})

describe('Hospital medical report authorization', () => {
  it('downloads a report after the hospital records an accepted reservation', async () => {
    const hospital = await approvedHospital()
    const { donor, report } = await donorWithReport()

    await acceptedDonorReservation(
      hospital.hospitalProfileId,
      donor.id,
      hospital.user.id
    )

    const response = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(hospital.token))

    expect(response.status).toBe(200)
  })

  it('denies report downloads without an accepted reservation', async () => {
    const hospital = await approvedHospital()
    const { report } = await donorWithReport()

    const response = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(hospital.token))

    expect(response.status).toBe(404)
  })

  it('requires a confirmed and accepted reservation', async () => {
    const hospital = await approvedHospital()
    const active = await donorWithReport()
    const declined = await donorWithReport()

    await acceptedDonorReservation(
      hospital.hospitalProfileId,
      active.donor.id,
      hospital.user.id,
      { status: 'ACTIVE' }
    )

    await acceptedDonorReservation(
      hospital.hospitalProfileId,
      declined.donor.id,
      hospital.user.id,
      { donorResponse: 'DECLINED' }
    )

    const activeResponse = await request(app)
      .get(`/api/hospital/reports/${active.report.id}/file`)
      .set('Authorization', auth(hospital.token))

    const declinedResponse = await request(app)
      .get(`/api/hospital/reports/${declined.report.id}/file`)
      .set('Authorization', auth(hospital.token))

    expect(activeResponse.status).toBe(404)
    expect(declinedResponse.status).toBe(404)
  })

  it('rechecks the reservation state on every download', async () => {
    const hospital = await approvedHospital()
    const { donor, report } = await donorWithReport()

    const reservation = await acceptedDonorReservation(
      hospital.hospitalProfileId,
      donor.id,
      hospital.user.id
    )

    const allowed = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(hospital.token))

    expect(allowed.status).toBe(200)

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        donorResponse: 'DECLINED',
        status: 'CANCELLED',
      },
    })

    const declined = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(hospital.token))

    expect(declined.status).toBe(404)

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        donorResponse: 'ACCEPTED',
        status: 'CONFIRMED',
        expiresAt: new Date(Date.now() - 60_000),
      },
    })

    const expired = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(hospital.token))

    expect(expired.status).toBe(404)
  })

  it('denies report downloads from another hospital accepted reservation', async () => {
    const viewer = await approvedHospital()
    const otherHospital = await approvedHospital()
    const { donor, report } = await donorWithReport()

    await acceptedDonorReservation(
      otherHospital.hospitalProfileId,
      donor.id,
      otherHospital.user.id
    )

    const response = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(404)
  })

  it('denies report downloads to hospitals that are not approved', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })
    const hospitalProfileId = user.hospitalProfile!.id
    const { donor, report } = await donorWithReport()

    await acceptedDonorReservation(
      hospitalProfileId,
      donor.id,
      user.id
    )

    const response = await request(app)
      .get(`/api/hospital/reports/${report.id}/file`)
      .set('Authorization', auth(tokenFor(user)))

    expect(response.status).toBe(403)
  })
})

describe('Doctor review assignment authorization', () => {
  it('hides unassigned donors from the doctor queue and report endpoints', async () => {
    const doctor = await doctorUser()
    const { donor, report } = await donorWithReport()

    const queue = await request(app)
      .get('/api/doctor/verifications')
      .set('Authorization', auth(doctor.token))

    expect(queue.status).toBe(200)
    expect(queue.body.donors).toEqual([])

    const detail = await request(app)
      .get(`/api/doctor/verifications/${donor.id}`)
      .set('Authorization', auth(doctor.token))

    expect(detail.status).toBe(404)

    const file = await request(app)
      .get(`/api/doctor/reports/${report.id}/file`)
      .set('Authorization', auth(doctor.token))

    expect(file.status).toBe(404)

    const decision = await request(app)
      .post(`/api/doctor/verifications/${donor.id}/decision`)
      .set('Authorization', auth(doctor.token))
      .send({ decision: 'VERIFY' })

    expect(decision.status).toBe(404)
  })

  it('lets an admin assign a donor and audits the assignment', async () => {
    const admin = await adminUser()
    const doctor = await doctorUser()
    const { donor } = await donorWithReport()

    const response = await request(app)
      .post(`/api/admin/donor-reviews/${donor.id}/assignment`)
      .set('Authorization', auth(admin.token))
      .send({ doctorUserId: doctor.user.id })

    expect(response.status).toBe(200)
    expect(response.body.assignment.doctorUserId).toBe(doctor.user.id)
    expect(response.body.assignment.doctor.id).toBe(doctor.user.id)

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'DOCTOR_REVIEW_ASSIGNED',
        entityId: donor.id,
      },
    })

    expect(audit).not.toBeNull()
    expect(audit?.actorUserId).toBe(admin.user.id)
  })

  it('rejects review assignment access for non-admin roles', async () => {
    const doctor = await doctorUser()
    const hospital = await approvedHospital()
    const { donor } = await donorWithReport()

    const doctorAssign = await request(app)
      .post(`/api/admin/donor-reviews/${donor.id}/assignment`)
      .set('Authorization', auth(doctor.token))
      .send({ doctorUserId: doctor.user.id })

    expect(doctorAssign.status).toBe(403)

    const hospitalList = await request(app)
      .get('/api/admin/review-assignments')
      .set('Authorization', auth(hospital.token))

    expect(hospitalList.status).toBe(403)

    const donorAssign = await request(app)
      .post(`/api/admin/donor-reviews/${donor.id}/assignment`)
      .set('Authorization', auth(donor.token))
      .send({ doctorUserId: doctor.user.id })

    expect(donorAssign.status).toBe(403)
  })

  it('grants the assigned doctor queue, detail, file and decision access', async () => {
    const admin = await adminUser()
    const doctor = await doctorUser()
    const { donor, report } = await donorWithReport()

    await request(app)
      .post(`/api/admin/donor-reviews/${donor.id}/assignment`)
      .set('Authorization', auth(admin.token))
      .send({ doctorUserId: doctor.user.id })
      .expect(200)

    const queue = await request(app)
      .get('/api/doctor/verifications')
      .set('Authorization', auth(doctor.token))

    expect(queue.status).toBe(200)
    expect(
      queue.body.donors.map((entry: { id: number }) => entry.id)
    ).toContain(donor.id)

    const detail = await request(app)
      .get(`/api/doctor/verifications/${donor.id}`)
      .set('Authorization', auth(doctor.token))

    expect(detail.status).toBe(200)

    const file = await request(app)
      .get(`/api/doctor/reports/${report.id}/file`)
      .set('Authorization', auth(doctor.token))

    expect(file.status).toBe(200)

    const decision = await request(app)
      .post(`/api/doctor/verifications/${donor.id}/decision`)
      .set('Authorization', auth(doctor.token))
      .send({ decision: 'VERIFY' })

    expect(decision.status).toBe(200)
    expect(decision.body.donor.verificationStatus).toBe('VERIFIED')
  })

  it('moves access when an admin reassigns the review', async () => {
    const admin = await adminUser()
    const firstDoctor = await doctorUser()
    const secondDoctor = await doctorUser()
    const { donor } = await donorWithReport()

    await assignDoctorReview(donor.id, firstDoctor.user.id)

    await request(app)
      .post(`/api/admin/donor-reviews/${donor.id}/assignment`)
      .set('Authorization', auth(admin.token))
      .send({ doctorUserId: secondDoctor.user.id })
      .expect(200)

    const firstDetail = await request(app)
      .get(`/api/doctor/verifications/${donor.id}`)
      .set('Authorization', auth(firstDoctor.token))

    expect(firstDetail.status).toBe(404)

    const secondDetail = await request(app)
      .get(`/api/doctor/verifications/${donor.id}`)
      .set('Authorization', auth(secondDoctor.token))

    expect(secondDetail.status).toBe(200)
  })

  it('rejects assigning an inactive or non-doctor account', async () => {
    const admin = await adminUser()
    const { user: donorUser } = await createUser({
      accountType: 'INDIVIDUAL',
    })
    const { donor } = await donorWithReport()

    const response = await request(app)
      .post(`/api/admin/donor-reviews/${donor.id}/assignment`)
      .set('Authorization', auth(admin.token))
      .send({ doctorUserId: donorUser.id })

    expect(response.status).toBe(400)
  })

  it('lists donors with their review assignments for admins', async () => {
    const admin = await adminUser()
    const doctor = await doctorUser()
    const { donor } = await donorWithReport()

    await assignDoctorReview(donor.id, doctor.user.id, admin.user.id)

    const response = await request(app)
      .get('/api/admin/review-assignments')
      .set('Authorization', auth(admin.token))

    expect(response.status).toBe(200)
    expect(response.body.doctors).toHaveLength(1)
    expect(response.body.doctors[0].id).toBe(doctor.user.id)

    const row = response.body.donors.find(
      (entry: { id: number }) => entry.id === donor.id
    )

    expect(row.reviewAssignment.doctor.id).toBe(doctor.user.id)
  })
})
