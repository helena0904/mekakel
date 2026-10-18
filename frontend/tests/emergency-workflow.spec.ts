import { expect, test } from '@playwright/test'

import { SEEDED_USERS, seedSession } from './helpers/session'

test.describe('emergency blood request workflow', () => {
  test('coordinates an emergency request through to matching sources', async ({
    page,
    request,
  }) => {
    await seedSession(
      page,
      request,
      SEEDED_USERS.hospital.email,
      'HOSPITAL'
    )

    await page.goto('/hospital/requests/new')

    await page
      .locator('#request-component')
      .selectOption('RED_CELLS')
    await page
      .locator('#request-blood-type')
      .selectOption('O_NEGATIVE')
    await page.locator('#request-units').fill('1')
    await page
      .locator('#request-urgency')
      .selectOption('EMERGENCY')
    await page
      .locator('#request-location')
      .fill('Addis Ababa')

    await page
      .getByRole('button', { name: 'Create request' })
      .click()

    await expect(page).toHaveURL(/\/hospital\/requests\/\d+$/)

    await page
      .getByRole('link', { name: /view matching sources/i })
      .click()

    await expect(page).toHaveURL(/\/hospital\/requests\/\d+\/matches$/)

    // The coordination aid always states it is not a clinical decision.
    await expect(
      page.getByText(/not a clinical transfusion decision/i)
    ).toBeVisible()

    // The seeded, compatible unit is surfaced as a candidate source.
    await expect(page.getByText('E2E-BAG-001')).toBeVisible()
  })
})
