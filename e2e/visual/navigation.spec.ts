import { type Page } from '@playwright/test'

import { OWNER } from './chain'
import { connectButton, expect, matchDialog, test, walletOption } from './fixtures'

const hamburger = (page: Page, isMobile: boolean) =>
  isMobile
    ? page.locator('div:has(> img[alt="SimpleX"]) ~ button')
    : page.locator('#header button').first()

test('menu with the TLD entry', async ({ page, app, isMobile }) => {
  await app.open('/', { accounts: [OWNER] })
  await hamburger(page, isMobile).click()
  await expect(page.locator('#chain-name:visible')).toHaveText('mainnet')
  await matchDialog(page, 'menu')
  await page.locator(':text-is(".simplex TLD"):visible').click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('connect modal', async ({ page, app, isMobile }) => {
  await app.open('/', { accounts: [OWNER], connected: false })
  await connectButton(page).click()
  await expect(walletOption(page, isMobile)).toBeVisible()
  await matchDialog(page, 'connect-modal')
})
