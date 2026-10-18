import { expect, test } from '@playwright/test'

import {
  SEEDED_USERS,
  loginViaUi,
  seedSession,
} from './helpers/session'

test.describe('authentication flow', () => {
  test('redirects anonymous visitors away from protected pages', async ({
    page,
  }) => {
    await page.goto('/donor-dashboard')

    await expect(page).toHaveURL(/\/login$/)
  })

  test('logs a donor in and lands on the donor dashboard', async ({
    page,
  }) => {
    await loginViaUi(page, SEEDED_USERS.donor.email)

    await expect(page).toHaveURL(/\/donor-dashboard$/)
    await expect(
      page.getByText(SEEDED_USERS.donor.heading)
    ).toBeVisible()
  })

  test('logs a hospital in and lands on the hospital dashboard', async ({
    page,
  }) => {
    await loginViaUi(
      page,
      SEEDED_USERS.hospital.email,
      'HOSPITAL'
    )

    await expect(page).toHaveURL(/\/hospital-dashboard$/)
    await expect(
      page.getByText(SEEDED_USERS.hospital.heading)
    ).toBeVisible()
  })

  test('shows an error for invalid credentials without revealing which field failed', async ({
    page,
  }) => {
    await loginViaUi(
      page,
      SEEDED_USERS.donor.email,
      'INDIVIDUAL',
      'Wrong1!Pass'
    )

    await expect(page.getByRole('alert')).toContainText(
      /invalid email or password/i
    )
    await expect(page).toHaveURL(/\/login$/)
  })

  test('logs the current session out', async ({ page, request }) => {
    await seedSession(
      page,
      request,
      SEEDED_USERS.donor.email,
      'INDIVIDUAL'
    )

    await page.goto('/donor-dashboard')
    await expect(
      page.getByText(SEEDED_USERS.donor.heading)
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Logout' })
      .click()

    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/donor-dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('accepts a password recovery request without disclosing accounts', async ({
    page,
  }) => {
    await page.goto('/forgot-password')

    await page.locator('#reset-email').fill('nobody@e2e.test')
    await page
      .getByRole('button', { name: /send reset link/i })
      .click()

    await expect(
      page.getByText(/check your email/i)
    ).toBeVisible()
  })

  test('keeps a valid session across a reload', async ({
    page,
    request,
  }) => {
    await seedSession(
      page,
      request,
      SEEDED_USERS.admin.email,
      'INDIVIDUAL'
    )

    await page.goto('/admin-dashboard')
    await expect(
      page.getByText(SEEDED_USERS.admin.heading)
    ).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL(/\/admin-dashboard$/)
    await expect(
      page.getByText(SEEDED_USERS.admin.heading)
    ).toBeVisible()
  })
})
