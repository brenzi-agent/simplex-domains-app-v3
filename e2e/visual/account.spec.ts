import { type Page } from '@playwright/test'

import {
  ACCOUNTS,
  generalTermsLink,
  holderOf,
  isCommunityName,
  minCharLength,
  OWNER,
  registerWithAllowance,
  reservationOf,
  setAllowance,
  TLD,
  unregister,
} from './chain'
import { expect, matchScreen, test } from './fixtures'

const HOLDER = 3
const RECEIVER = 2
const TRADEMARK = 2
const OTHER_COMMIT = '1'.repeat(40)

const matchSection = async (page: Page, title: string, name: string) => {
  await page.getByText(title, { exact: true }).scrollIntoViewIfNeeded()
  await matchScreen(page, name)
}

const settled = async (page: Page) =>
  expect(page.getByText(/^(Sending \w+\.\.\.|Tx sent: .*|\w+ confirmed)$/)).toHaveCount(0)

test('my names without a name ended in its dispute period', async ({ page, app }) => {
  await setAllowance(HOLDER, 1000)
  await registerWithAllowance('keptname', HOLDER)
  await registerWithAllowance('endedname', HOLDER)
  await unregister('endedname')
  await app.open('/', { accounts: [HOLDER] })
  await app.goto('/my/names')
  const names = page.getByTestId('names-list')
  await expect(names).toContainText(`keptname.${TLD}`)
  await expect(names).not.toContainText(`endedname.${TLD}`)
  await matchScreen(page, 'my-names.png')
})

test('admin page of the owner and guardian', async ({ page, app }) => {
  await app.open('/admin', { accounts: [OWNER] })
  await expect(page.getByText('You are the owner')).toBeVisible()
  await expect(page.getByTestId('admin-general-terms-text')).toBeVisible()
  await expect(page.getByTestId('admin-community-terms-text')).toBeVisible()
  await matchScreen(page, 'admin.png')
  await page.getByLabel('Check name', { exact: true }).fill('simplex-chat')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('RESERVED (Internal)')).toBeVisible()
  await matchSection(page, 'Check Reserved Name', 'admin-check.png')
  await matchSection(page, 'General Terms', 'admin-general-terms.png')
  await matchSection(page, 'Community Names', 'admin-community-names.png')
  await matchSection(page, 'Register Reserved Name', 'admin-register-reserved.png')
})

test('admin actions of the owner and guardian', async ({ page, app }) => {
  await app.open('/admin', { accounts: [OWNER] })
  await expect(page.getByText('You are the owner')).toBeVisible()

  await page.getByTestId('admin-new-min-char-input').fill('5')
  await page.getByTestId('admin-set-min-char-button').click()
  await expect.poll(minCharLength).toBe(5)
  await settled(page)
  await matchSection(page, 'Min Character Length', 'admin-min-length-set.png')

  await page.getByLabel('Reserve name(s)', { exact: true }).fill('brandname')
  await page.getByRole('button', { name: 'Reserve', exact: true }).click()
  await expect.poll(() => reservationOf('brandname')).toBe(TRADEMARK)
  await settled(page)
  await page.getByLabel('Unreserve name(s)', { exact: true }).fill('simplex-chat')
  await page.getByRole('button', { name: 'Unreserve', exact: true }).click()
  await expect.poll(() => reservationOf('simplex-chat')).toBe(0)
  await settled(page)
  await matchSection(page, 'Reserved Names', 'admin-reserved-changed.png')

  const newTermsLink = (await generalTermsLink()).replace(/[0-9a-f]{40}/, OTHER_COMMIT)
  await page.getByTestId('admin-general-terms-input').fill(newTermsLink)
  await page.getByTestId('admin-general-terms-set').click()
  await expect.poll(generalTermsLink).toBe(newTermsLink)
  await settled(page)
  await expect(page.getByTestId('admin-general-terms-link')).toContainText(newTermsLink)
  await matchSection(page, 'General Terms', 'admin-general-terms-set.png')

  await page.getByLabel('List name(s)', { exact: true }).fill('cityname')
  await page.getByTestId('admin-list-community').click()
  await expect.poll(() => isCommunityName('cityname')).toBe(true)
  await settled(page)
  await page.getByLabel('Unlist name(s)', { exact: true }).fill('communityclaim')
  await page.getByRole('button', { name: 'Unlist', exact: true }).click()
  await expect.poll(() => isCommunityName('communityclaim')).toBe(false)
  await settled(page)
  await matchSection(page, 'Community Names', 'admin-community-names-changed.png')

  await page.getByLabel('Label', { exact: true }).fill('simplex')
  await page.getByLabel('Owner address', { exact: true }).fill(ACCOUNTS[RECEIVER].address)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await expect
    .poll(() => holderOf('simplex').catch(() => undefined))
    .toBe(ACCOUNTS[RECEIVER].address)
  await settled(page)
  await matchSection(page, 'Register Reserved Name', 'admin-reserved-registered.png')
})

test('name policy page', async ({ page, app }) => {
  await app.open('/namepolicy')
  await expect(page.getByTestId('name-policy-reserved')).toContainText(`simplex-chat.${TLD}`)
  await expect(page.getByTestId('name-policy-community')).toContainText(`communityname.${TLD}`)
  await matchScreen(page, 'name-policy.png')

  await page.getByLabel('Search names', { exact: true }).fill('claim')
  await expect(page.getByTestId('name-policy-community-count')).toHaveText('1 of 2')
  await expect(page.getByTestId('name-policy-reserved-count')).toHaveText('0 of 2')
  await matchScreen(page, 'name-policy-search.png')
})
