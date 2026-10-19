import request from 'supertest'

import { createApp } from './helpers/app'
import {
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  addDonor,
  addUnit,
  adminUser,
  approvedHospital,
  auth,
  requestBody,
} from './helpers/actors'
import { assignFefoRank } from '../src/services/fefo.service'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000

async function createRequest(
  token: string,
  overrides: Record<string, unknown> = {}
) {
  const res = await request(app)
    .post('/api/requests')
    .set('Authorization', auth(token))
    .send(requestBody(overrides))

  return res.body.request.id as number
}

async function matchesFor(token: string, requestId: number) {
  const res = await request(app)
    .get(`/api/matching/requests/${requestId}/matches`)
    .set('Authorization', auth(token))

  return res.body.matches
}

function unitTypes(matches: { units: { bloodType: string }[] }) {
  return matches.units.map((unit) => unit.bloodType).sort()
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('component-aware compatibility', () => {
  it('applies red-cell ABO and Rh rules for a positive recipient', async () => {
    const hospital = await approvedHospital()

    for (const bloodType of [
      'O_NEGATIVE',
      'O_POSITIVE',
      'A_NEGATIVE',
      'A_POSITIVE',
      'B_POSITIVE',
      'AB_POSITIVE',
    ]) {
      await addUnit(hospital.hospitalProfileId, { bloodType })
    }

    const requestId = await createRequest(hospital.token, {
      bloodType: 'A_POSITIVE',
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(unitTypes(matches)).toEqual([
      'A_NEGATIVE',
      'A_POSITIVE',
      'O_NEGATIVE',
      'O_POSITIVE',
    ])
  })

  it('requires Rh-negative units for an Rh-negative recipient', async () => {
    const hospital = await approvedHospital()

    for (const bloodType of [
      'O_NEGATIVE',
      'O_POSITIVE',
      'A_NEGATIVE',
      'A_POSITIVE',
    ]) {
      await addUnit(hospital.hospitalProfileId, { bloodType })
    }

    const requestId = await createRequest(hospital.token, {
      bloodType: 'A_NEGATIVE',
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(unitTypes(matches)).toEqual([
      'A_NEGATIVE',
      'O_NEGATIVE',
    ])
  })

  it('reverses the ABO direction for plasma', async () => {
    const hospital = await approvedHospital()

    for (const bloodType of [
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'O_POSITIVE',
    ]) {
      await addUnit(hospital.hospitalProfileId, {
        bloodType,
        component: 'PLASMA',
      })
    }

    const requestId = await createRequest(hospital.token, {
      component: 'PLASMA',
      bloodType: 'A_POSITIVE',
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(unitTypes(matches)).toEqual([
      'AB_NEGATIVE',
      'AB_POSITIVE',
      'A_NEGATIVE',
      'A_POSITIVE',
    ])
  })

  it('matches only the requested component', async () => {
    const hospital = await approvedHospital()

    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      component: 'RED_CELLS',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      component: 'PLASMA',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
      component: 'PLATELETS',
    })

    const requestId = await createRequest(hospital.token, {
      component: 'PLATELETS',
      bloodType: 'A_POSITIVE',
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(matches.units).toHaveLength(1)
    expect(matches.units[0].component).toBe('PLATELETS')
  })
})

describe('FEFO allocation', () => {
  it('ranks the earliest-expiring units first and breaks ties by id', async () => {
    const hospital = await approvedHospital()

    const soon = await addUnit(hospital.hospitalProfileId, {
      expiryDate: new Date(Date.now() + 10 * DAY),
    })
    const soonTie = await addUnit(hospital.hospitalProfileId, {
      expiryDate: new Date(Date.now() + 10 * DAY),
    })
    const later = await addUnit(hospital.hospitalProfileId, {
      expiryDate: new Date(Date.now() + 30 * DAY),
    })
    const median = await addUnit(hospital.hospitalProfileId, {
      expiryDate: new Date(Date.now() + 20 * DAY),
    })

    const requestId = await createRequest(hospital.token)

    const matches = await matchesFor(hospital.token, requestId)

    expect(matches.units.map((unit: { unitId: number }) => unit.unitId)).toEqual([
      soon.id,
      soonTie.id,
      median.id,
      later.id,
    ])
    expect(matches.units.map((unit: { fefoRank: number }) => unit.fefoRank)).toEqual([
      1, 2, 3, 4,
    ])
  })
})

describe('unit availability filtering', () => {
  it('excludes unscreened, unconfirmed, reserved, expired and unapproved stocks', async () => {
    const requester = await approvedHospital()
    const source = await approvedHospital()

    await addUnit(source.hospitalProfileId)
    await addUnit(source.hospitalProfileId, {
      screeningStatus: 'PENDING',
    })
    await addUnit(source.hospitalProfileId, {
      confirmationStatus: 'PENDING',
    })
    await addUnit(source.hospitalProfileId, { status: 'RESERVED' })
    await addUnit(source.hospitalProfileId, {
      collectionDate: new Date(Date.now() - 40 * DAY),
      expiryDate: new Date(Date.now() - DAY),
    })

    const requestId = await createRequest(requester.token)

    const matches = await matchesFor(requester.token, requestId)

    expect(matches.units).toHaveLength(1)
    expect(matches.units[0].hospitalName).toBe('Test Hospital')
  })
})

describe('donor eligibility and availability', () => {
  it('returns only compatible, eligible, available, active donors', async () => {
    const hospital = await approvedHospital()

    await addDonor({ bloodType: 'O_NEGATIVE' })
    await addDonor({
      bloodType: 'O_NEGATIVE',
      lastDonation: new Date(Date.now() - 10 * DAY),
    })
    await addDonor({ bloodType: 'O_NEGATIVE', weight: 45 })
    await addDonor({
      bloodType: 'O_NEGATIVE',
      verificationStatus: 'PENDING',
    })
    await addDonor({
      bloodType: 'O_NEGATIVE',
      currentAvailability: 'UNAVAILABLE',
    })
    await addDonor({
      bloodType: 'O_NEGATIVE',
      userActive: false,
    })
    await addDonor({ bloodType: 'B_NEGATIVE' })

    const requestId = await createRequest(hospital.token, {
      bloodType: 'O_NEGATIVE',
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(matches.donors).toHaveLength(1)
    expect(matches.donors[0].bloodType).toBe('O_NEGATIVE')
    expect(matches.donors[0].contactAllowed).toBe(true)
  })

  it('excludes donors who have not consented to contact', async () => {
    const hospital = await approvedHospital()

    await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: false,
      shareLocation: false,
    })

    const requestId = await createRequest(hospital.token)

    const matches = await matchesFor(hospital.token, requestId)

    expect(matches.donors).toHaveLength(0)
  })

  it('excludes donors who opted out of matching', async () => {
    const hospital = await approvedHospital()

    await addDonor({
      bloodType: 'O_NEGATIVE',
      matchingOptOut: true,
    })

    const requestId = await createRequest(hospital.token)

    const matches = await matchesFor(hospital.token, requestId)

    expect(matches.donors).toHaveLength(0)
  })

  it('withholds location but keeps consented contact details', async () => {
    const hospital = await approvedHospital()

    await addDonor({
      bloodType: 'O_NEGATIVE',
      consentToContact: true,
      shareLocation: false,
      address: 'Addis Ababa, Bole',
    })

    const requestId = await createRequest(hospital.token)

    const matches = await matchesFor(hospital.token, requestId)

    const donor = matches.donors[0]

    expect(donor.contactAllowed).toBe(true)
    expect(donor.contactPhone).toBeTruthy()
    expect(donor.shareLocation).toBe(false)
    expect(donor.address).toBeNull()
    expect(donor.approximateArea).toBeNull()
    expect(donor).not.toHaveProperty('weight')
    expect(donor).not.toHaveProperty('height')
    expect(donor).not.toHaveProperty('faydaId')
    expect(donor).not.toHaveProperty('dateOfBirth')
  })
})

describe('governance policy affects matching', () => {
  it('can relax Rh enforcement through administrator settings', async () => {
    const hospital = await approvedHospital()
    const admin = await adminUser()

    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_NEGATIVE',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_POSITIVE',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'A_POSITIVE',
    })

    const requestId = await createRequest(hospital.token, {
      bloodType: 'A_NEGATIVE',
    })

    const before = await matchesFor(hospital.token, requestId)
    expect(unitTypes(before)).toEqual(['O_NEGATIVE'])

    const updated = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', auth(admin.token))
      .send({ compatibility: { enforceRh: false } })

    expect(updated.status).toBe(200)

    const after = await matchesFor(hospital.token, requestId)

    expect(unitTypes(after)).toEqual([
      'A_POSITIVE',
      'O_NEGATIVE',
      'O_POSITIVE',
    ])
  })

  it('can revert plasma to the standard ABO direction', async () => {
    const hospital = await approvedHospital()
    const admin = await adminUser()

    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'O_POSITIVE',
      component: 'PLASMA',
    })
    await addUnit(hospital.hospitalProfileId, {
      bloodType: 'AB_POSITIVE',
      component: 'PLASMA',
    })

    await request(app)
      .put('/api/admin/settings')
      .set('Authorization', auth(admin.token))
      .send({ compatibility: { plasmaReversed: false } })

    const requestId = await createRequest(hospital.token, {
      component: 'PLASMA',
      bloodType: 'A_POSITIVE',
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(unitTypes(matches)).toEqual(['O_POSITIVE'])
  })
})

describe('matching summary', () => {
  it('reports the shortfall and the clinical disclaimer', async () => {
    const hospital = await approvedHospital()

    await addUnit(hospital.hospitalProfileId)

    const requestId = await createRequest(hospital.token, {
      requiredUnits: 5,
    })

    const matches = await matchesFor(hospital.token, requestId)

    expect(matches.summary.compatibleUnits).toBe(1)
    expect(matches.summary.requiredUnits).toBe(5)
    expect(matches.summary.shortfall).toBe(4)
    expect(matches.disclaimer).toMatch(
      /not a clinical transfusion decision/i
    )
  })
})

describe('FEFO ordering', () => {
  const expiry = (day: number) => new Date(Date.UTC(2026, 0, day))
  const collection = (day: number) => new Date(Date.UTC(2025, 11, day))

  it('orders eligible units by earliest expiry', () => {
    const ranked = assignFefoRank([
      { id: 1, expiryDate: expiry(20) },
      { id: 2, expiryDate: expiry(10) },
      { id: 3, expiryDate: expiry(15) },
    ])

    expect(ranked.map((unit) => unit.id)).toEqual([2, 3, 1])
  })

  it('breaks equal expiry by oldest collection date', () => {
    const ranked = assignFefoRank([
      {
        id: 1,
        expiryDate: expiry(10),
        collectionDate: collection(5),
      },
      {
        id: 2,
        expiryDate: expiry(10),
        collectionDate: collection(1),
      },
    ])

    expect(ranked.map((unit) => unit.id)).toEqual([2, 1])
  })

  it('then prefers the closest unit, the bag id and finally the id', () => {
    const ranked = assignFefoRank([
      {
        id: 1,
        expiryDate: expiry(10),
        collectionDate: collection(1),
        distanceKm: 12,
        bagId: 'BAG-B',
      },
      {
        id: 2,
        expiryDate: expiry(10),
        collectionDate: collection(1),
        distanceKm: 3,
        bagId: 'BAG-Z',
      },
      {
        id: 3,
        expiryDate: expiry(10),
        collectionDate: collection(1),
        distanceKm: 3,
        bagId: 'BAG-A',
      },
      {
        id: 4,
        expiryDate: expiry(10),
        collectionDate: collection(1),
        distanceKm: null,
        bagId: 'BAG-A',
      },
    ])

    expect(ranked.map((unit) => unit.id)).toEqual([3, 2, 1, 4])
  })
})
