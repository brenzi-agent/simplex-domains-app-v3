import { type Locator, type Page } from '@playwright/test'

import { OWNER, registerWithAllowance, setAllowance, TLD, unregister } from './chain'
import { around, expect, matchScreenshot, test } from './fixtures'

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
  await matchScreenshot(names, 'my-names.png')
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

  await matchScreenshot(adminCard(page, 'Controller State', owner), 'controller.png')
  await matchScreenshot(
    adminCard(page, 'Contracts in use', page.getByText(/^Multicall: /)),
    'contracts.png',
  )
  await matchScreenshot(adminCard(page, 'Check Reserved Name', checked), 'check.png')
  await matchScreenshot(
    adminCard(page, 'Min Character Length', page.getByTestId('admin-set-min-char-button')),
    'min-length.png',
  )
  await matchScreenshot(
    adminCard(page, 'Reserved Names', page.getByRole('button', { name: 'Unreserve' })),
    'reserved.png',
  )
  await matchScreenshot(adminCard(page, 'General Terms', generalTerms), 'general-terms.png')
  await matchScreenshot(adminCard(page, 'Community Names', communityTerms), 'community-names.png')
  await matchScreenshot(
    adminCard(page, 'Register Reserved Name', page.getByRole('button', { name: 'Register' })),
    'register-reserved.png',
  )
})

test('name policy page', async ({ page, app }) => {
  await app.open('/namepolicy')
  const reserved = page.getByTestId('name-policy-reserved')
  const community = page.getByTestId('name-policy-community')
  await expect(reserved).toContainText(`simplex-chat.${TLD}`)
  await expect(community).toContainText(`communityname.${TLD}`)
  const policy = around(page, page.getByRole('heading', { name: 'Name policy' }), community)
  await matchScreenshot(policy, 'name-policy.png')

  await page.getByLabel('Search names', { exact: true }).fill('claim')
  await expect(page.getByTestId('name-policy-community-count')).toHaveText('1 of 2')
  await expect(page.getByTestId('name-policy-reserved-count')).toHaveText('0 of 2')
  await matchScreenshot(policy, 'name-policy-search.png')
})
