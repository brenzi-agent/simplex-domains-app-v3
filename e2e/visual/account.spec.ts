import { type Page } from '@playwright/test'

import { REASONS } from '@app/utils/snrcNamePolicy'

import {
  accountOf,
  generalTermsLink,
  holderOf,
  isCommunityName,
  minCharLength,
  OWNER,
  register,
  registerWithAllowance,
  reservationOf,
  setAllowance,
  TLD,
  unregister,
  type User,
} from './chain'
import { expect, matchScreen, test } from './fixtures'

const HOLDER: User = 'user4'
const RECEIVER: User = 'user3'
const OTHER_COMMIT = '1'.repeat(40)

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

for (const { viewer, wallet } of [
  { viewer: 'holder', wallet: { accounts: [HOLDER] } },
  { viewer: 'visitor', wallet: undefined },
] as const) {
  test(`address page of a name's holder, opened by its ${viewer}`, async ({ page, app }) => {
    await register('addressname', HOLDER)
    await app.open(`/address?address=${accountOf(HOLDER).address}`, wallet)
    await expect(page.getByTestId('names-list')).toContainText(`addressname.${TLD}`)
    await matchScreen(page, `address-${viewer}.png`)
  })
}

test.describe('admin page', () => {
  test.skip(({ isMobile }) => isMobile, '/admin is desktop-only')

  test('admin page of the owner and guardian', async ({ page, app }) => {
    await app.open('/admin', { accounts: [OWNER] })
    await expect(page.getByText('You are the owner')).toBeVisible()
    await expect(page.getByTestId('admin-general-terms-text')).toBeVisible()
    await expect(page.getByTestId('admin-community-terms-text')).toBeVisible()
    await matchScreen(page, 'admin.png')
    await page.getByLabel('Check name', { exact: true }).fill('simplex-chat')
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.getByText('RESERVED (Internal)')).toBeVisible()
    await matchScreen(page, 'admin-check.png')
  })

  test('admin actions of the owner and guardian', async ({ page, app }) => {
    await app.open('/admin', { accounts: [OWNER] })
    await expect(page.getByText('You are the owner')).toBeVisible()

    await page.getByTestId('admin-new-min-char-input').fill('5')
    await page.getByTestId('admin-set-min-char-button').click()
    await expect.poll(minCharLength).toBe(5)
    await settled(page)
    await matchScreen(page, 'admin-min-length-set.png')

    await page.getByLabel('Reserve name(s)', { exact: true }).fill('brandname')
    await page.getByRole('button', { name: 'Reserve', exact: true }).click()
    await expect.poll(() => reservationOf('brandname')).toBe(REASONS.indexOf('Trademark'))
    await settled(page)
    await page.getByLabel('Unreserve name(s)', { exact: true }).fill('simplex-chat')
    await page.getByRole('button', { name: 'Unreserve', exact: true }).click()
    await expect.poll(() => reservationOf('simplex-chat')).toBe(REASONS.indexOf('None'))
    await settled(page)
    await matchScreen(page, 'admin-reserved-changed.png')

    const newTermsLink = (await generalTermsLink()).replace(/[0-9a-f]{40}/, OTHER_COMMIT)
    await page.getByTestId('admin-general-terms-input').fill(newTermsLink)
    await page.getByTestId('admin-general-terms-set').click()
    await expect.poll(generalTermsLink).toBe(newTermsLink)
    await settled(page)
    await expect(page.getByTestId('admin-general-terms-link')).toContainText(newTermsLink)
    await matchScreen(page, 'admin-general-terms-set.png')

    await page.getByLabel('List name(s)', { exact: true }).fill('cityname')
    await page.getByTestId('admin-list-community').click()
    await expect.poll(() => isCommunityName('cityname')).toBe(true)
    await settled(page)
    await page.getByLabel('Unlist name(s)', { exact: true }).fill('communityclaim')
    await page.getByRole('button', { name: 'Unlist', exact: true }).click()
    await expect.poll(() => isCommunityName('communityclaim')).toBe(false)
    await settled(page)
    await matchScreen(page, 'admin-community-names-changed.png')

    await page.getByLabel('Label', { exact: true }).fill('simplex')
    await page.getByLabel('Owner address', { exact: true }).fill(accountOf(RECEIVER).address)
    await page.getByRole('button', { name: 'Register', exact: true }).click()
    await expect
      .poll(() => holderOf('simplex').catch(() => undefined))
      .toBe(accountOf(RECEIVER).address)
    await settled(page)
    await matchScreen(page, 'admin-reserved-registered.png')
  })
})

test('name policy page', async ({ page, app }) => {
  await app.open('/namepolicy')
  await expect(page.getByTestId('name-policy-reserved')).toContainText(`simplex-chat.${TLD}`)
  await expect(page.getByTestId('name-policy-community')).toContainText(`communityname.${TLD}`)
  await expect(page.getByTestId('name-policy-reserved-count')).toHaveText('840')
  await expect(page.getByTestId('name-policy-community-count')).toHaveText('459')
  await matchScreen(page, 'name-policy.png')

  await page.getByLabel('Search names', { exact: true }).fill('claim')
  await expect(page.getByTestId('name-policy-community-count')).toHaveText('1 of 459')
  await expect(page.getByTestId('name-policy-reserved-count')).toHaveText('0 of 840')
  await matchScreen(page, 'name-policy-search.png')
})
