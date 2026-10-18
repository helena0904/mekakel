import { expect, test } from '@playwright/test'

import { SEEDED_USERS, seedSession } from './helpers/session'

test.beforeEach(async ({ page, request }) => {
  await seedSession(
    page,
    request,
    SEEDED_USERS.donor.email,
    'INDIVIDUAL'
  )
})

test.describe('donor flow', () => {
  test('opens the donor dashboard with eligibility guidance', async ({
    page,
  }) => {
    await page.goto('/donor-dashboard')

    await expect(
      page.getByText(SEEDED_USERS.donor.heading)
    ).toBeVisible()
    await expect(
      page.getByText(/welcome, e2e donor/i)
    ).toBeVisible()
  })

  test('updates the donor profile', async ({ page }) => {
    await page.goto('/donor/profile')

    await page.locator('#donor-phone').fill('+251900000099')
    await page.locator('#donor-weight').fill('73')
    await page.locator('#donor-height').fill('178')

    await page
      .getByRole('button', { name: 'Save profile' })
      .click()

    await expect(page.getByRole('status')).toContainText(
      /profile updated successfully/i
    )
  })

  test('updates donation availability', async ({ page }) => {
    await page.goto('/donor/availability')

    await page
      .locator('#donor-current-availability')
      .selectOption('AVAILABLE')

    await page.locator('#donor-day-MONDAY').check()

    await page
      .locator('.availability-row', {
        has: page.locator('#donor-day-MONDAY'),
      })
      .locator('input[type="time"]')
      .fill('09:00')

    await page
      .getByRole('button', { name: 'Save availability' })
      .click()

    await expect(page.getByRole('status')).toContainText(
      /availability updated successfully/i
    )
  })

  test('shows the medical report upload and privacy controls', async ({
    page,
  }) => {
    await page.goto('/donor/medical-reports')

    await expect(page.locator('#report-type')).toBeVisible()
    await expect(page.locator('#report-file')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Upload report' })
    ).toBeVisible()
  })

  test('does not let a donor open hospital pages', async ({ page }) => {
    await page.goto('/hospital/inventory')

    await expect(page).toHaveURL(/\/donor-dashboard$/)
  })
})
