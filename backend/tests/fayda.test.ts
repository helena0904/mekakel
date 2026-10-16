import request from 'supertest'

import {
  verifyMockFayda,
  MOCK_FAYDA_IDENTITIES,
} from '../src/services/fayda.service'
import { createApp } from './helpers/app'
import { resetDatabase, disconnectDatabase } from './helpers/db'

const app = createApp()

const IDENTITY = MOCK_FAYDA_IDENTITIES[0]

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('mock Fayda service (unit)', () => {
  it('accepts a seeded identity with matching id, name and date', () => {
    const result = verifyMockFayda(
      IDENTITY.faydaId,
      IDENTITY.fullName,
      IDENTITY.dateOfBirth
    )

    expect(result.verified).toBe(true)
    expect(result.identity).toEqual({
      fullName: IDENTITY.fullName,
      dateOfBirth: IDENTITY.dateOfBirth,
    })
  })

  it('accepts a case-insensitive and whitespace-normalized name', () => {
    const result = verifyMockFayda(
      IDENTITY.faydaId,
      `  ${IDENTITY.fullName.toUpperCase()}  `,
      IDENTITY.dateOfBirth
    )

    expect(result.verified).toBe(true)
  })

  it('rejects a Fayda ID that is not exactly 16 digits', () => {
    expect(verifyMockFayda('123', IDENTITY.fullName, IDENTITY.dateOfBirth).verified).toBe(
      false
    )
    expect(
      verifyMockFayda(
        '12345678901234567',
        IDENTITY.fullName,
        IDENTITY.dateOfBirth
      ).verified
    ).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(
      verifyMockFayda(IDENTITY.faydaId, '   ', IDENTITY.dateOfBirth).verified
    ).toBe(false)
  })

  it('rejects an unparsable date of birth', () => {
    expect(
      verifyMockFayda(IDENTITY.faydaId, IDENTITY.fullName, 'not-a-date')
        .verified
    ).toBe(false)
  })

  it('rejects a well-formed id that is not a seeded record', () => {
    expect(
      verifyMockFayda('1234567890123456', 'John Doe', '1990-01-01').verified
    ).toBe(false)
  })

  it('rejects a seeded id when the name does not match', () => {
    expect(
      verifyMockFayda(IDENTITY.faydaId, 'Someone Else', IDENTITY.dateOfBirth)
        .verified
    ).toBe(false)
  })

  it('rejects a seeded id when the date of birth does not match', () => {
    expect(
      verifyMockFayda(IDENTITY.faydaId, IDENTITY.fullName, '1990-01-01')
        .verified
    ).toBe(false)
  })
})

describe('POST /api/fayda/verify', () => {
  it('returns a simulated success payload for a seeded identity', async () => {
    const res = await request(app)
      .post('/api/fayda/verify')
      .send({
        faydaId: IDENTITY.faydaId,
        fullName: IDENTITY.fullName,
        dateOfBirth: IDENTITY.dateOfBirth,
      })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      simulated: true,
    })
    expect(res.body.identity).toEqual({
      fullName: IDENTITY.fullName,
      dateOfBirth: IDENTITY.dateOfBirth,
    })
  })

  it('returns success:false for a well-formed but unseeded identity', async () => {
    const res = await request(app)
      .post('/api/fayda/verify')
      .send({
        faydaId: '1234567890123456',
        fullName: 'John Doe',
        dateOfBirth: '1990-01-01',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(false)
    expect(res.body.identity).toBeNull()
  })

  it('returns 400 for a malformed Fayda ID', async () => {
    const res = await request(app)
      .post('/api/fayda/verify')
      .send({
        faydaId: '123',
        fullName: IDENTITY.fullName,
        dateOfBirth: IDENTITY.dateOfBirth,
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.identity).toBeNull()
  })

  it('returns 400 for a missing name', async () => {
    const res = await request(app)
      .post('/api/fayda/verify')
      .send({
        faydaId: IDENTITY.faydaId,
        fullName: '',
        dateOfBirth: IDENTITY.dateOfBirth,
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 for a malformed date of birth', async () => {
    const res = await request(app)
      .post('/api/fayda/verify')
      .send({
        faydaId: IDENTITY.faydaId,
        fullName: IDENTITY.fullName,
        dateOfBirth: '15/05/2000',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
