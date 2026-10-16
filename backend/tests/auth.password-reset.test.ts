import request from 'supertest'
import bcrypt from 'bcrypt'
import nodemailer from 'nodemailer'
import { createHash } from 'node:crypto'

import { createApp } from './helpers/app'
import { prisma, resetDatabase, disconnectDatabase } from './helpers/db'
import {
  createUser,
  uniqueEmail,
  uniqueIp,
  TEST_PASSWORD,
} from './helpers/factories'

const app = createApp()

const GENERIC_MESSAGE =
  'If an account exists with that email, a password reset link will be sent.'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function forgotPassword(body: Record<string, unknown>, ip = uniqueIp()) {
  return request(app)
    .post('/api/auth/forgot-password')
    .set('X-Forwarded-For', ip)
    .send(body)
}

function resetPassword(body: Record<string, unknown>, ip = uniqueIp()) {
  return request(app)
    .post('/api/auth/reset-password')
    .set('X-Forwarded-For', ip)
    .send(body)
}

let sendMailMock: jest.Mock

function sentMail(): { to: string; text: string; html: string } {
  expect(sendMailMock).toHaveBeenCalled()
  return sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1][0]
}

function tokenFrom(mail: { text: string; html: string }): string {
  const match = mail.text.match(
    new RegExp(`token=([a-f0-9]{64})`)
  )
  if (!match) {
    throw new Error('No reset token found in the sent email')
  }
  return match[1]
}

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

describe('POST /api/auth/forgot-password', () => {
  it('stores only a hashed token and emails a working reset link', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    const res = await forgotPassword({ email: user.email })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe(GENERIC_MESSAGE)

    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const mail = sentMail()
    expect(mail.to).toBe(user.email)
    expect(mail.text).toContain(
      `${FRONTEND_URL}/reset-password?token=`
    )

    const rawToken = tokenFrom(mail)
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/)

    const record = await prisma.passwordResetToken.findUnique({
      where: { userId: user.id },
    })

    expect(record).not.toBeNull()
    expect(record!.tokenHash).toBe(hashToken(rawToken))
    expect(record!.tokenHash).not.toBe(rawToken)
    expect(record!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('does not reveal whether an unknown email exists', async () => {
    const res = await forgotPassword({ email: uniqueEmail('nobody') })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe(GENERIC_MESSAGE)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(await prisma.passwordResetToken.count()).toBe(0)
  })

  it('rejects an invalid email with 400', async () => {
    const res = await forgotPassword({ email: 'not-an-email' })

    expect(res.status).toBe(400)
  })

  it('invalidates a previous token when a new one is requested', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })

    await forgotPassword({ email: user.email })
    const firstToken = tokenFrom(sentMail())

    await forgotPassword({ email: user.email })
    const secondToken = tokenFrom(sentMail())

    expect(secondToken).not.toBe(firstToken)

    const stale = await resetPassword({
      token: firstToken,
      password: 'NewPassword1!',
    })
    expect(stale.status).toBe(400)

    const fresh = await resetPassword({
      token: secondToken,
      password: 'NewPassword1!',
    })
    expect(fresh.status).toBe(200)
  })

  it('removes the token and still responds generically when email sending fails', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    sendMailMock.mockRejectedValue(new Error('SMTP down'))

    const res = await forgotPassword({ email: user.email })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe(GENERIC_MESSAGE)
    expect(
      await prisma.passwordResetToken.count({ where: { userId: user.id } })
    ).toBe(0)
  })
})

describe('POST /api/auth/reset-password', () => {
  it('updates the password, consumes the token, and bumps passwordVersion', async () => {
    const { user } = await createUser({
      accountType: 'INDIVIDUAL',
      passwordVersion: 0,
    })

    await forgotPassword({ email: user.email })
    const token = tokenFrom(sentMail())

    const res = await resetPassword({
      token,
      password: 'BrandNewPass1!',
    })

    expect(res.status).toBe(200)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    await expect(
      bcrypt.compare('BrandNewPass1!', updated!.passwordHash)
    ).resolves.toBe(true)
    await expect(
      bcrypt.compare(TEST_PASSWORD, updated!.passwordHash)
    ).resolves.toBe(false)
    expect(updated!.passwordVersion).toBe(1)

    expect(
      await prisma.passwordResetToken.findUnique({
        where: { userId: user.id },
      })
    ).toBeNull()
  })

  it('rejects reusing the same token with 400', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    await forgotPassword({ email: user.email })
    const token = tokenFrom(sentMail())

    expect(
      (await resetPassword({ token, password: 'FirstChange1!' })).status
    ).toBe(200)

    const reuse = await resetPassword({
      token,
      password: 'SecondChange1!',
    })

    expect(reuse.status).toBe(400)
    expect(reuse.body.message).toMatch(/invalid or expired/i)
  })

  it('rejects a token with an invalid format with 400', async () => {
    const res = await resetPassword({
      token: 'not-a-valid-token',
      password: 'NewPassword1!',
    })

    expect(res.status).toBe(400)
  })

  it('rejects a well-formed but unknown token with 400', async () => {
    const res = await resetPassword({
      token: 'b'.repeat(64),
      password: 'NewPassword1!',
    })

    expect(res.status).toBe(400)
  })

  it('rejects an expired token with 400', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    const rawToken = 'a'.repeat(64)

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() - 1000),
      },
    })

    const res = await resetPassword({
      token: rawToken,
      password: 'NewPassword1!',
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid or expired/i)
  })

  it('rejects a too-short password with 400', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    await forgotPassword({ email: user.email })
    const token = tokenFrom(sentMail())

    const res = await resetPassword({ token, password: 'short' })

    expect(res.status).toBe(400)
  })

  it('rejects a weak password that fails the strength policy with 400', async () => {
    const { user } = await createUser({ accountType: 'INDIVIDUAL' })
    await forgotPassword({ email: user.email })
    const token = tokenFrom(sentMail())

    // 9 chars, lowercase + digit, but no uppercase or special character.
    const res = await resetPassword({ token, password: 'weakpass1' })

    expect(res.status).toBe(400)
  })
})
