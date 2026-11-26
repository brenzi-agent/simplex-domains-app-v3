import { type Page } from '@playwright/test'

import { OWNER } from './chain'
import { connectButton, expect, matchScreen, test } from './fixtures'

const hamburger = (page: Page, isMobile: boolean) =>
  isMobile
    ? page.locator('div:has(> img[alt="SimpleX"]) ~ button')
    : page.locator('#header button').first()

test('menu with the TLD entry', async ({ page, app, isMobile }) => {
  await app.open('/', { accounts: [OWNER] })
  await hamburger(page, isMobile).click()
  await expect(page.locator('#chain-name:visible')).toHaveText('localhost')
  await matchScreen(page, 'menu.png')
  await page.locator(':text-is(".simplex TLD"):visible').click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('connect modal', async ({ page, app }) => {
  await app.open('/', { accounts: [OWNER], connected: false })
  await connectButton(page).click()
  await expect(page.getByRole('dialog').getByText('Headless Web3 Provider')).toBeVisible()
  await matchScreen(page, 'connect-modal.png')
})
