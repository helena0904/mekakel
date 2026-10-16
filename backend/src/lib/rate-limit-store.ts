import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  Store,
} from 'express-rate-limit'

import prisma from './prisma'

/**
 * Postgres-backed rate-limit store.
 *
 * Unlike the default in-memory store, counters live in the database, so they
 * survive restarts and are shared across every running instance.
 *
 * Each limiter must use its own namespace so independent limiters (register,
 * login, forgot-password, ...) do not share the same counter for a client.
 */
export class PostgresRateLimitStore implements Store {
  localKeys = false
  prefix: string

  private windowMs = 15 * 60 * 1000

  constructor(private readonly namespace: string) {
    this.prefix = `${namespace}:`
  }

  init(options: Options): void {
    if (typeof options.windowMs === 'number' && options.windowMs > 0) {
      this.windowMs = options.windowMs
    }
  }

  private key(key: string): string {
    return `${this.namespace}:${key}`
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = new Date()
    const resetAt = new Date(now.getTime() + this.windowMs)
    const namespacedKey = this.key(key)

    const rows = await prisma.$queryRaw<
      { count: number; expiresAt: Date }[]
    >`
      INSERT INTO "RateLimitCounter" ("key", "count", "expiresAt")
      VALUES (${namespacedKey}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitCounter"."expiresAt" <= ${now} THEN 1
          ELSE "RateLimitCounter"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimitCounter"."expiresAt" <= ${now} THEN ${resetAt}
          ELSE "RateLimitCounter"."expiresAt"
        END
      RETURNING "count", "expiresAt"
    `

    const row = rows[0]

    return {
      totalHits: Number(row.count),
      resetTime: row.expiresAt,
    }
  }

  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "RateLimitCounter"
      SET "count" = GREATEST("count" - 1, 0)
      WHERE "key" = ${this.key(key)}
    `
  }

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimitCounter.deleteMany({
      where: { key: this.key(key) },
    })
  }

  async resetAll(): Promise<void> {
    await prisma.rateLimitCounter.deleteMany()
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const row = await prisma.rateLimitCounter.findUnique({
      where: { key: this.key(key) },
    })

    if (!row) {
      return undefined
    }

    return {
      totalHits: row.count,
      resetTime: row.expiresAt,
    }
  }
}
