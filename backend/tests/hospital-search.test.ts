import request from 'supertest'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  acceptedDonorReservation,
  addDonor,
  addUnit,
  approvedHospital,
  auth,
  DAY,
  tokenFor,
} from './helpers/actors'
import { createUser } from './helpers/factories'

const app = createApp()

async function locateHospital(
  hospitalProfileId: number,
  subcity: string,
  wereda: string
) {
  await prisma.hospitalProfile.update({
    where: { id: hospitalProfileId },
    data: {
      subcity,
      wereda,
      address: `${wereda}, ${subcity}`,
    },
  })
}

describe('hospital nearby search', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  it('returns nearby approved hospitals with compatible available units', async () => {
    const viewer = await approvedHospital()
    await locateHospital(viewer.hospitalProfileId, 'Bole', 'Woreda 03')

    const nearby = await approvedHospital()
    await locateHospital(nearby.hospitalProfileId, 'Bole', 'Woreda 03')

    await addUnit(nearby.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      expiryDate: new Date(Date.now() + 30 * DAY),
    })
    await addUnit(nearby.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      expiryDate: new Date(Date.now() + 10 * DAY),
    })
    await addUnit(nearby.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      status: 'USED',
    })
    await addUnit(nearby.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      expiryDate: new Date(Date.now() - DAY),
    })

    const response = await request(app)
      .get('/api/hospital/search?bloodType=O_NEGATIVE')
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.location.subcity).toBe('Bole')
    expect(response.body.hospitals).toHaveLength(1)
    expect(response.body.hospitals[0].id).toBe(nearby.hospitalProfileId)
    expect(response.body.hospitals[0].availableUnits).toBe(2)
    expect(response.body.hospitals[0].unitSummary).toEqual([
      { bloodType: 'O_NEGATIVE', component: 'RED_CELLS', availableUnits: 2 },
    ])
    expect(response.body.hospitals[0].unitDetails).toHaveLength(2)
    expect(response.body.hospitals[0].unitDetails[0]).toMatchObject({
      bloodType: 'O_NEGATIVE',
      component: 'RED_CELLS',
    })
    expect(response.body.hospitals[0].unitDetails[0].bagId).toMatch(/^BAG-/)
    expect(response.body.hospitals[0].unitDetails[0].collectionDate).toBeDefined()
    expect(response.body.hospitals[0].unitDetails[0].expiryDate).toBeDefined()
  })

  it('excludes incompatible blood types when a blood type is requested', async () => {
    const viewer = await approvedHospital()
    await locateHospital(viewer.hospitalProfileId, 'Bole', 'Woreda 03')

    const nearby = await approvedHospital()
    await locateHospital(nearby.hospitalProfileId, 'Bole', 'Woreda 03')

    await addUnit(nearby.hospitalProfileId, { bloodType: 'A_POSITIVE' })

    const response = await request(app)
      .get('/api/hospital/search?bloodType=O_NEGATIVE')
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.hospitals).toHaveLength(1)
    expect(response.body.hospitals[0].availableUnits).toBe(0)
    expect(response.body.hospitals[0].unitSummary).toEqual([])
    expect(response.body.hospitals[0].unitDetails).toEqual([])
  })

  it('returns nearby donors and respects each donor privacy choice', async () => {
    const viewer = await approvedHospital()
    await locateHospital(viewer.hospitalProfileId, 'Bole', 'Woreda 03')

    const activeDonor = await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: true,
    })
    await prisma.donorProfile.update({
      where: { id: activeDonor.id },
      data: {
        activeStatus: 'ACTIVE',
        subcity: 'Bole',
        wereda: 'Woreda 03',
      },
    })

    const privateDonor = await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: false,
    })
    await prisma.donorProfile.update({
      where: { id: privateDonor.id },
      data: {
        activeStatus: 'ACTIVE',
        subcity: 'Bole',
        wereda: 'Woreda 03',
      },
    })

    const inactiveDonor = await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: true,
    })
    await prisma.donorProfile.update({
      where: { id: inactiveDonor.id },
      data: {
        activeStatus: 'INACTIVE',
        subcity: 'Bole',
        wereda: 'Woreda 03',
      },
    })

    const response = await request(app)
      .get('/api/hospital/search?bloodType=O_NEGATIVE')
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.donors).toHaveLength(3)

    const active = response.body.donors.find(
      (donor: { donorProfileId: number }) =>
        donor.donorProfileId === activeDonor.id
    )
    const privateDonorRow = response.body.donors.find(
      (donor: { donorProfileId: number }) =>
        donor.donorProfileId === privateDonor.id
    )

    expect(active.contactAllowed).toBe(true)
    expect(active.contactPhone).toBe(activeDonor.phone)
    expect(active.compatibility.compatible).toBe(true)

    expect(privateDonorRow.contactAllowed).toBe(false)
    expect(privateDonorRow.contactPhone).toBeNull()
  })

  it('lists nearby donors that are not yet verified or active', async () => {
    const viewer = await approvedHospital()
    await locateHospital(viewer.hospitalProfileId, 'Bole', 'Woreda 03')

    const donor = await addDonor({
      bloodType: 'O_NEGATIVE',
      verificationStatus: 'PENDING',
    })
    await prisma.donorProfile.update({
      where: { id: donor.id },
      data: {
        activeStatus: 'INACTIVE',
        bloodType: null,
        subcity: 'Bole',
        wereda: 'Woreda 03',
      },
    })

    const response = await request(app)
      .get('/api/hospital/search')
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.donors).toHaveLength(1)
    expect(response.body.donors[0].donorProfileId).toBe(donor.id)
    expect(response.body.donors[0].bloodType).toBeNull()
  })

  it('returns donor details with medical reports after an accepted reservation', async () => {
    const viewer = await approvedHospital()
    await locateHospital(viewer.hospitalProfileId, 'Bole', 'Woreda 03')

    const donor = await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: true,
      shareLocation: true,
    })
    await prisma.donorProfile.update({
      where: { id: donor.id },
      data: {
        activeStatus: 'ACTIVE',
        subcity: 'Bole',
        wereda: 'Woreda 03',
      },
    })

    const donorUser = await prisma.user.findUniqueOrThrow({
      where: { id: donor.userId },
    })

    const report = await prisma.medicalReport.create({
      data: {
        donorProfileId: donor.id,
        uploadedByUserId: donor.userId,
        reportType: 'IMAGE',
        fileUrl: 'test-report.png',
        verificationStatus: 'VERIFIED',
      },
    })

    await acceptedDonorReservation(
      viewer.hospitalProfileId,
      donor.id,
      viewer.user.id
    )

    const response = await request(app)
      .get(`/api/hospital/donors/${donor.id}`)
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.donor.donorProfileId).toBe(donor.id)
    expect(response.body.donor.displayName).toBe(donorUser.name)
    expect(response.body.donor.faydaId).toBeUndefined()
    expect(response.body.donor.reportsRestricted).toBe(false)
    expect(response.body.donor.medicalReports).toHaveLength(1)
    expect(response.body.donor.medicalReports[0].id).toBe(report.id)
    expect(response.body.donor.medicalReports[0].fileUrl).toBeUndefined()
  })

  it('restricts medical reports without an accepted reservation', async () => {
    const viewer = await approvedHospital()
    const donor = await addDonor()

    await prisma.medicalReport.create({
      data: {
        donorProfileId: donor.id,
        uploadedByUserId: donor.userId,
        reportType: 'IMAGE',
        fileUrl: 'test-report.png',
        verificationStatus: 'VERIFIED',
      },
    })

    const response = await request(app)
      .get(`/api/hospital/donors/${donor.id}`)
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.donor.reportsRestricted).toBe(true)
    expect(response.body.donor.medicalReports).toEqual([])
  })

  it('does not unlock reports through another hospital reservation', async () => {
    const viewer = await approvedHospital()
    const otherHospital = await approvedHospital()
    const donor = await addDonor()

    await prisma.medicalReport.create({
      data: {
        donorProfileId: donor.id,
        uploadedByUserId: donor.userId,
        reportType: 'IMAGE',
        fileUrl: 'test-report.png',
        verificationStatus: 'VERIFIED',
      },
    })

    await acceptedDonorReservation(
      otherHospital.hospitalProfileId,
      donor.id,
      otherHospital.user.id
    )

    const response = await request(app)
      .get(`/api/hospital/donors/${donor.id}`)
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.donor.reportsRestricted).toBe(true)
    expect(response.body.donor.medicalReports).toEqual([])
  })

  it('does not unlock reports through an expired accepted reservation', async () => {
    const viewer = await approvedHospital()
    const donor = await addDonor()

    await acceptedDonorReservation(
      viewer.hospitalProfileId,
      donor.id,
      viewer.user.id,
      { expiresAt: new Date(Date.now() - DAY) }
    )

    const response = await request(app)
      .get(`/api/hospital/donors/${donor.id}`)
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(200)
    expect(response.body.donor.reportsRestricted).toBe(true)
  })

  it('sends a one-click urgent blood request notification to a donor', async () => {
    const viewer = await approvedHospital()
    await locateHospital(viewer.hospitalProfileId, 'Bole', 'Woreda 03')

    const donor = await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: true,
    })

    const response = await request(app)
      .post(`/api/hospital/donors/${donor.id}/request`)
      .set('Authorization', auth(viewer.token))

    expect(response.status).toBe(201)
    expect(response.body.request.donorProfileId).toBe(donor.id)

    const notification =
      await prisma.notification.findFirst({
        where: {
          userId: donor.userId,
          type: 'DONOR_BLOOD_REQUESTED',
        },
      })

    expect(notification).not.toBeNull()
    expect(notification?.subject).toMatch(/blood/i)
    expect(notification?.body).toMatch(/needs blood now/i)
    expect(notification?.category).toBe('DONOR')
  })

  it('rejects individual accounts', async () => {
    const donor = await addDonor()

    const response = await request(app)
      .get('/api/hospital/search')
      .set(
        'Authorization',
        auth(
          tokenFor({
            id: donor.userId,
            role: 'DONOR',
            accountType: 'INDIVIDUAL',
          })
        )
      )

    expect(response.status).toBe(403)
  })

  it('allows hospitals that are not yet approved to search', async () => {
    const { user } = await createUser({
      accountType: 'HOSPITAL',
      hospitalVerified: false,
    })

    const response = await request(app)
      .get('/api/hospital/search')
      .set('Authorization', auth(tokenFor(user)))

    expect(response.status).toBe(200)
    expect(response.body.hospitals).toEqual([])
    expect(response.body.donors).toEqual([])
  })
})
