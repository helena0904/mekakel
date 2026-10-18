import { expect, test } from '@playwright/test'

import { SEEDED_USERS, seedSession } from './helpers/session'

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

test.beforeEach(async ({ page, request }) => {
  await seedSession(
    page,
    request,
    SEEDED_USERS.hospital.email,
    'HOSPITAL'
  )
})

test.describe('hospital flow', () => {
  test('opens the hospital dashboard for an approved facility', async ({
    page,
  }) => {
    await page.goto('/hospital-dashboard')

    await expect(
      page.getByText(SEEDED_USERS.hospital.heading)
    ).toBeVisible()
  })

  test('lists existing inventory and adds a screened unit', async ({
    page,
  }) => {
    await page.goto('/hospital/inventory')

    await expect(page.getByText('E2E-BAG-001')).toBeVisible()

    await page.getByRole('button', { name: 'Add unit' }).click()

    const bagId = `E2E-UI-${Date.now()}`

    await page.locator('#unit-bag-id').fill(bagId)
    await page.locator('#unit-blood-type').selectOption('O_NEGATIVE')
    await page.locator('#unit-collection-date').fill(isoDate(-2))
    await page.locator('#unit-expiry-date').fill(isoDate(30))
    await page.locator('#unit-screening').selectOption('PASSED')
    await page
      .locator('#unit-confirmation')
      .selectOption('CONFIRMED')

    await page.getByRole('button', { name: 'Add unit' }).click()

    await expect(
      page.getByRole('cell').filter({ hasText: bagId })
    ).toBeVisible()
  })

  test('manages hospital staff', async ({ page }) => {
    await page.goto('/hospital/staff')

    await expect(
      page.getByRole('button', { name: /add staff member/i })
    ).toBeVisible()
  })
})
