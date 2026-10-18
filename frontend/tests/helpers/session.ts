import { expect } from '@playwright/test'
import type {
  APIRequestContext,
  Page,
} from '@playwright/test'

export const SEEDED_PASSWORD = 'Password1!'

const BACKEND_URL =
  process.env.E2E_BACKEND_URL ?? 'http://localhost:3000'

let ipSequence = 0

/**
 * The backend rate-limits logins per client IP. E2E provisioning logs in many
 * times, so every API login presents a unique forwarded address (the backend
 * runs with TRUST_PROXY=1).
 */
function uniqueIp(): string {
  ipSequence += 1
  const a = Math.floor(ipSequence / 65536) % 256
  const b = Math.floor(ipSequence / 256) % 256
  const c = ipSequence % 256
  return `10.${a}.${b}.${c}`
}

export const SEEDED_USERS = {
  admin: {
    email: 'admin@e2e.test',
    accountType: 'INDIVIDUAL' as const,
    dashboard: '/admin-dashboard',
    heading: 'Administrator Dashboard',
  },
  doctor: {
    email: 'doctor@e2e.test',
    accountType: 'INDIVIDUAL' as const,
    dashboard: '/doctor-dashboard',
    heading: 'Clinical Reviewer Dashboard',
  },
  donor: {
    email: 'donor@e2e.test',
    accountType: 'INDIVIDUAL' as const,
    dashboard: '/donor-dashboard',
    heading: 'Individual Donor Dashboard',
  },
  hospital: {
    email: 'hospital@e2e.test',
    accountType: 'HOSPITAL' as const,
    dashboard: '/hospital-dashboard',
    heading: 'Hospital / Clinic Dashboard',
  },
} as const

export function accountTypeButton(accountType: 'INDIVIDUAL' | 'HOSPITAL') {
  return accountType === 'HOSPITAL'
    ? 'Hospital / Clinic'
    : 'Individual Donor'
}

export async function loginViaUi(
  page: Page,
  email: string,
  accountType: 'INDIVIDUAL' | 'HOSPITAL' = 'INDIVIDUAL',
  password: string = SEEDED_PASSWORD
): Promise<void> {
  await page.goto('/login')
  await page
    .getByRole('button', { name: accountTypeButton(accountType) })
    .click()
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}

export interface Session {
  token: string
  user: {
    id: number
    name: string
    email: string
    role: string
    accountType: string
  }
}

/**
 * Logs in through the API and injects the session into localStorage so a
 * spec can start authenticated without repeating the login form. The app
 * rehydrates the session through `GET /users/me` on every load.
 */
export async function seedSession(
  page: Page,
  request: APIRequestContext,
  email: string,
  accountType: 'INDIVIDUAL' | 'HOSPITAL' = 'INDIVIDUAL'
): Promise<Session> {
  const res = await request.post(`${BACKEND_URL}/api/auth/login`, {
    headers: { 'X-Forwarded-For': uniqueIp() },
    data: {
      email,
      password: SEEDED_PASSWORD,
      accountType,
    },
  })

  expect(res.ok()).toBeTruthy()

  const session = (await res.json()) as Session

  await page.addInitScript(
    (value) => {
      window.localStorage.setItem('token', value.token)
      window.localStorage.setItem(
        'user',
        JSON.stringify(value.user)
      )
    },
    { token: session.token, user: session.user }
  )

  return session
}
