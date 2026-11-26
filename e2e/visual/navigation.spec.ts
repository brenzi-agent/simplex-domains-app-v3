import { OWNER } from './chain'
import { around, expect, test } from './fixtures'

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

const menuOf = (page: Parameters<typeof around>[0]) => {
  const chainName = page.locator('#chain-name:visible')
  return { chainName, menu: around(page, page.getByText('Language'), chainName).locator('..') }
}

test('menu with the TLD entry', async ({ page, app }) => {
  await app.open('/', { as: [OWNER] })
  await page.locator('#header button').first().click()
  const { chainName, menu } = menuOf(page)
  await expect(chainName).toHaveText('localhost')
  await expect(menu).toHaveScreenshot('menu.png')
  await menu.getByText('.simplex TLD').click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('connect modal', async ({ page, app }) => {
  await app.open('/', { as: [OWNER], connected: false })
  await page.getByTestId('connect-button').click()
  const modal = page.getByRole('dialog').getByRole('document')
  await expect(modal.getByText('Headless Web3 Provider')).toBeVisible()
  await expect(modal).toHaveScreenshot('connect-modal.png')
})

test.describe('phone', () => {
  test.use(PHONE)

  test('home page', async ({ page, app }) => {
    await app.open('/')
    await expect(page.getByTestId('tabbar-connect-button')).toBeVisible()
    await expect(page).toHaveScreenshot('phone-home.png')
  })

  test('menu with the TLD entry', async ({ page, app }) => {
    await app.open('/', { as: [OWNER] })
    await around(page, page.locator('img[alt="SimpleX"]:visible'), page.locator('button:visible'))
      .locator('button')
      .click()
    const { chainName, menu } = menuOf(page)
    await expect(chainName).toHaveText('localhost')
    await expect(menu).toHaveScreenshot('phone-menu.png')
  })

  test('connect modal', async ({ page, app }) => {
    await app.open('/', { as: [OWNER], connected: false })
    await page.getByTestId('tabbar-connect-button').click()
    const modal = page.getByRole('dialog').getByRole('document')
    await expect(modal.getByText('Headless Web3 Provider')).toBeVisible()
    await expect(modal).toHaveScreenshot('phone-connect-modal.png')
  })
})
