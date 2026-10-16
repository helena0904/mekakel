import request from 'supertest'

import { createApp } from './helpers/app'
import { resetDatabase, disconnectDatabase } from './helpers/db'
import { PostgresRateLimitStore } from '../src/lib/rate-limit-store'
import { uniqueIp } from './helpers/factories'

const app = createApp()

beforeEach(resetDatabase)

afterAll(disconnectDatabase)

describe('PostgresRateLimitStore', () => {
  it('shares hit counts across store instances (database-backed, not in-memory)', async () => {
    const storeA = new PostgresRateLimitStore('shared-ns')
    const storeB = new PostgresRateLimitStore('shared-ns')

    expect((await storeA.increment('client-1')).totalHits).toBe(1)
    expect((await storeB.increment('client-1')).totalHits).toBe(2)
    expect((await storeA.increment('client-1')).totalHits).toBe(3)
  })

  it('keeps separate namespaces independent', async () => {
    const register = new PostgresRateLimitStore('register')
    const login = new PostgresRateLimitStore('login')

    expect((await register.increment('client-2')).totalHits).toBe(1)
    expect((await login.increment('client-2')).totalHits).toBe(1)
  })

  it('resets a single key', async () => {
    const store = new PostgresRateLimitStore('resettable')

    await store.increment('client-3')
    await store.increment('client-3')
    await store.resetKey('client-3')

    expect((await store.increment('client-3')).totalHits).toBe(1)
  })
})

describe('rate limiting over HTTP', () => {
  it('returns 429 after the login limit is exceeded for one client', async () => {
    const ip = uniqueIp()
    const body = {
      email: 'nobody@example.test',
      password: 'Password1!',
      accountType: 'INDIVIDUAL',
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send(body)
      expect(res.status).toBe(401)
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send(body)

    expect(blocked.status).toBe(429)
  })
})
