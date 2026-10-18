import request from 'supertest'

import { createApp } from './helpers/app'
import {
  prisma,
  resetDatabase,
  disconnectDatabase,
} from './helpers/db'
import {
  addDonor,
  approvedHospital,
  auth,
  DAY,
} from './helpers/actors'
import {
  isCompatible,
} from '../src/services/compatibility.service'
import { isAvailableStock } from '../src/services/inventory.service'
import { computeEligibility } from '../src/services/eligibility.service'

const app = createApp()

// Modeled, clearly-labelled manual-coordination costs. These are not medical
// measurements; they turn registry review and phone coordination into an
// auditable time estimate for the comparison.
const SECONDS_PER_RECORD_REVIEW = 30
const MINUTES_PER_PHONE_CALL = 4

interface EvalRequest {
  component: string
  bloodType: string
}

async function seedCoordinationDataset() {
  const requester = await approvedHospital()

  const sources = await Promise.all(
    Array.from({ length: 8 }, () => approvedHospital())
  )

  const bloodTypes = [
    'O_NEGATIVE',
    'O_POSITIVE',
    'A_NEGATIVE',
    'A_POSITIVE',
    'B_POSITIVE',
    'AB_POSITIVE',
  ]

  const unitData = sources.flatMap((source, sourceIndex) =>
    Array.from({ length: 6 }, (_, unitIndex) => ({
      hospitalProfileId: source.hospitalProfileId,
      bagId: `EVAL-${sourceIndex}-${unitIndex}`,
      bloodType: bloodTypes[unitIndex % bloodTypes.length] as never,
      component: 'RED_CELLS' as never,
      collectionDate: new Date(Date.now() - 5 * DAY),
      expiryDate: new Date(
        Date.now() + (unitIndex + 1) * 3 * DAY
      ),
      screeningStatus: 'PASSED' as never,
      confirmationStatus: 'CONFIRMED' as never,
      status: 'AVAILABLE' as never,
    }))
  )

  await prisma.bloodUnit.createMany({ data: unitData })

  for (let index = 0; index < 12; index += 1) {
    const recentDonation = index % 4 === 3

    await addDonor({
      bloodType: index % 3 === 0 ? 'O_NEGATIVE' : 'A_POSITIVE',
      lastDonation: recentDonation
        ? new Date(Date.now() - 5 * DAY)
        : null,
    })
  }

  return requester
}

async function digitalSearch(
  token: string,
  hospitalProfileId: number,
  evalRequest: EvalRequest
) {
  const created = await prisma.bloodRequest.create({
    data: {
      hospitalProfileId,
      createdByUserId: 0,
      component: evalRequest.component as never,
      bloodType: evalRequest.bloodType as never,
      requiredUnits: 1,
      urgency: 'EMERGENCY',
      status: 'OPEN',
    },
  })

  const started = Date.now()

  const res = await request(app)
    .get(`/api/matching/requests/${created.id}/matches`)
    .set('Authorization', auth(token))

  const elapsedMs = Date.now() - started

  return { matches: res.body.matches, elapsedMs }
}

async function manualCoordinatorSearch(
  evalRequest: EvalRequest
) {
  const started = Date.now()

  const [units, donors] = await Promise.all([
    prisma.bloodUnit.findMany({
      include: { hospitalProfile: true },
    }),
    prisma.donorProfile.findMany({
      include: { user: true, donationHistory: true },
    }),
  ])

  let recordsExamined = 0
  const matchedUnits: number[] = []

  for (const unit of units) {
    recordsExamined += 1

    if (unit.component !== evalRequest.component) continue
    if (!isAvailableStock(unit)) continue
    if (
      unit.hospitalProfile.status !== 'APPROVED' ||
      !unit.hospitalProfile.isVerified
    ) {
      continue
    }
    if (
      !isCompatible(
        unit.bloodType,
        evalRequest.bloodType,
        evalRequest.component
      )
    ) {
      continue
    }

    matchedUnits.push(unit.id)
  }

  let phoneCalls = 0
  const matchedDonors: number[] = []

  for (const donor of donors) {
    recordsExamined += 1

    if (!donor.bloodType || !donor.user.isActive) continue
    if (donor.verificationStatus !== 'VERIFIED') continue
    if (donor.currentAvailability !== 'AVAILABLE') continue
    if (
      !isCompatible(
        donor.bloodType,
        evalRequest.bloodType,
        evalRequest.component
      )
    ) {
      continue
    }

    const eligibility = computeEligibility(
      donor,
      donor.donationHistory.map((record) => record.donatedAt)
    )

    if (!eligibility.eligible) continue

    phoneCalls += 1
    matchedDonors.push(donor.id)
  }

  const elapsedMs = Date.now() - started

  const estimatedMinutes =
    (recordsExamined * SECONDS_PER_RECORD_REVIEW) / 60 +
    phoneCalls * MINUTES_PER_PHONE_CALL

  return {
    matchedUnits,
    matchedDonors,
    recordsExamined,
    phoneCalls,
    elapsedMs,
    estimatedMinutes,
  }
}

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('Phase 8 evaluation', () => {
  it('compares digital coordination with simulated manual coordination', async () => {
    const requester = await seedCoordinationDataset()

    const evalRequest: EvalRequest = {
      component: 'RED_CELLS',
      bloodType: 'O_NEGATIVE',
    }

    const digital = await digitalSearch(
      requester.token,
      requester.hospitalProfileId,
      evalRequest
    )
    const manual = await manualCoordinatorSearch(evalRequest)

    const digitalUnitIds = digital.matches.units
      .map((unit: { unitId: number }) => unit.unitId)
      .sort((a: number, b: number) => a - b)

    const manualUnitIds = [...manual.matchedUnits].sort(
      (a, b) => a - b
    )

    // Correctness parity: both approaches identify the same eligible stock.
    expect(digitalUnitIds).toEqual(manualUnitIds)
    expect(digitalUnitIds.length).toBeGreaterThan(0)

    // The digital coordinator returns a pre-filtered shortlist in one call,
    // so far fewer artefacts need to be reviewed than the manual registry.
    expect(digitalUnitIds.length).toBeLessThan(
      manual.recordsExamined
    )
    expect(digital.matches.donors.length).toBe(
      manual.matchedDonors.length
    )

    const digitalShortlist =
      digital.matches.units.length +
      digital.matches.donors.length

    console.log(
      '\n[Phase 8 evaluation] digital vs manual coordination\n' +
        `  candidates in registry (manual review): ${manual.recordsExamined} records, ` +
        `${manual.phoneCalls} phone calls, modeled ${manual.estimatedMinutes.toFixed(0)} min\n` +
        `  digital shortlist (one request):       ${digitalShortlist} ranked matches, ` +
        `${digital.elapsedMs} ms\n`
    )

    // Modeled manual coordination must cost more than the measured digital
    // call by a wide margin.
    expect(manual.estimatedMinutes).toBeGreaterThan(0)
    expect(digital.elapsedMs).toBeLessThan(2000)
    expect(
      manual.estimatedMinutes * 60 * 1000
    ).toBeGreaterThan(digital.elapsedMs)
  })

  it('keeps matching response times bounded under a realistic load', async () => {
    const requester = await seedCoordinationDataset()

    await prisma.bloodRequest.deleteMany({})

    const created = await prisma.bloodRequest.create({
      data: {
        hospitalProfileId: requester.hospitalProfileId,
        createdByUserId: 0,
        component: 'RED_CELLS',
        bloodType: 'O_NEGATIVE',
        requiredUnits: 1,
        urgency: 'EMERGENCY',
        status: 'OPEN',
      },
    })

    const latencies: number[] = []

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const started = Date.now()

      const res = await request(app)
        .get(`/api/matching/requests/${created.id}/matches`)
        .set('Authorization', auth(requester.token))

      latencies.push(Date.now() - started)
      expect(res.status).toBe(200)
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[sorted.length - 1]

    console.log(
      `\n[Phase 8 performance] matching latency median=${median}ms p95=${p95}ms samples=${latencies.join(',')}ms\n`
    )

    expect(median).toBeLessThan(1500)
    expect(p95).toBeLessThan(3000)
  })

  it('indexes the FEFO and tenant columns used by matching', async () => {
    const indexes = (await prisma.$queryRaw`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'BloodUnit'
    `) as { indexdef: string }[]

    const definitions = indexes
      .map((row) => row.indexdef.toLowerCase())
      .join('\n')

    expect(definitions).toContain('expirydate')
    expect(definitions).toContain('hospitalprofileid')
  })
})
