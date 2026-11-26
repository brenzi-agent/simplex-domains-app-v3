import { type Locator, type Page } from '@playwright/test'

import { OWNER, registerWithAllowance, setAllowance, TLD, unregister } from './chain'
import { around, expect, test } from './fixtures'

const HOLDER = 3
const DISPUTE_DAYS = 14n

test('my names without a name ended in its dispute period', async ({ page, app }) => {
  await setAllowance(HOLDER, 1000)
  await registerWithAllowance('keptname', HOLDER, DISPUTE_DAYS)
  await registerWithAllowance('endedname', HOLDER, DISPUTE_DAYS)
  await unregister('endedname')
  await app.open('/my/names', { as: [HOLDER] })
  const names = page.getByTestId('names-list')
  await expect(names).toContainText(`keptname.${TLD}`)
  await expect(names).not.toContainText(`endedname.${TLD}`)
  await expect(names).toHaveScreenshot('my-names.png')
})

const adminCard = (page: Page, title: string, landmark: Locator) =>
  around(page, page.getByText(title, { exact: true }), landmark).locator('..')

test('admin page of the owner and guardian', async ({ page, app }) => {
  await app.open('/admin', { as: [OWNER] })
  const owner = page.getByText('You are the owner')
  const generalTerms = page.getByTestId('admin-general-terms-text')
  const communityTerms = page.getByTestId('admin-community-terms-text')
  await expect(owner).toBeVisible()
  await expect(generalTerms).toBeVisible()
  await expect(communityTerms).toBeVisible()
  await page.getByLabel('Check name', { exact: true }).fill('simplex-chat')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  const checked = page.getByText('RESERVED (Internal)')
  await expect(checked).toBeVisible()

  await expect(adminCard(page, 'Controller State', owner)).toHaveScreenshot('controller.png')
  await expect(
    adminCard(page, 'Contracts in use', page.getByText(/^Multicall: /)),
  ).toHaveScreenshot('contracts.png')
  await expect(adminCard(page, 'Check Reserved Name', checked)).toHaveScreenshot('check.png')
  await expect(
    adminCard(page, 'Min Character Length', page.getByTestId('admin-set-min-char-button')),
  ).toHaveScreenshot('min-length.png')
  await expect(
    adminCard(page, 'Reserved Names', page.getByRole('button', { name: 'Unreserve' })),
  ).toHaveScreenshot('reserved.png')
  await expect(adminCard(page, 'General Terms', generalTerms)).toHaveScreenshot('general-terms.png')
  await expect(adminCard(page, 'Community Names', communityTerms)).toHaveScreenshot(
    'community-names.png',
  )
  await expect(
    adminCard(page, 'Register Reserved Name', page.getByRole('button', { name: 'Register' })),
  ).toHaveScreenshot('register-reserved.png')
})
