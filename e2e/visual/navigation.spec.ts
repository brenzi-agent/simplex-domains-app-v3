import { type Page } from '@playwright/test'

import { OWNER } from './chain'
import { around, expect, matchScreenshot, test } from './fixtures'

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

const menuOf = (page: Page) => {
  const chainName = page.locator('#chain-name:visible')
  return { chainName, menu: around(page, page.getByText('Language'), chainName).locator('..') }
}

test('menu with the TLD entry', async ({ page, app }) => {
  await app.open('/', { as: [OWNER] })
  await page.locator('#header button').first().click()
  const { chainName, menu } = menuOf(page)
  await expect(chainName).toHaveText('localhost')
  await matchScreenshot(menu, 'menu.png')
  await menu.getByText('.simplex TLD').click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('connect modal', async ({ page, app }) => {
  await app.open('/', { as: [OWNER], connected: false })
  await page.getByTestId('connect-button').click()
  const modal = page.getByRole('dialog').getByRole('document')
  await expect(modal.getByText('Headless Web3 Provider')).toBeVisible()
  await matchScreenshot(modal, 'connect-modal.png')
})

test.describe('phone', () => {
  test.use(PHONE)

  test('home page', async ({ page, app }) => {
    await app.open('/')
    await expect(page.getByTestId('tabbar-connect-button')).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot('phone-home.png')
  })

  test('menu with the TLD entry', async ({ page, app }) => {
    await app.open('/', { as: [OWNER] })
    await around(page, page.locator('img[alt="SimpleX"]:visible'), page.locator('button:visible'))
      .locator('button')
      .click()
    const { chainName, menu } = menuOf(page)
    await expect(chainName).toHaveText('localhost')
    await matchScreenshot(menu, 'phone-menu.png')
  })

  test('connect modal', async ({ page, app }) => {
    await app.open('/', { as: [OWNER], connected: false })
    await page.getByTestId('tabbar-connect-button').click()
    const modal = page.getByRole('dialog').getByRole('document')
    await expect(modal.getByText('Headless Web3 Provider')).toBeVisible()
    await matchScreenshot(modal, 'phone-connect-modal.png')
  })
})
