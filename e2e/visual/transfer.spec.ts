import { type Locator, type Page } from '@playwright/test'

import {
  ACCOUNTS,
  expiryOf,
  holderOf,
  offer,
  offeredTo,
  register,
  registerWithAllowance,
  setAllowance,
  TLD,
} from './chain'
import {
  around,
  completeTransactions,
  expect,
  matchScreenshot,
  test,
  transactionDialog,
} from './fixtures'

const HOLDER = 1
const RECIPIENT = 2
const SELECTED = 1
const TEMPORARY_OWNER = 2
const OTHER = 3
const DISPUTE_DAYS = 14n

const bannerOf = (page: Page, title: Locator, action: Locator) =>
  around(page, title, action).locator('..')

const ownershipPanel = (page: Page) =>
  around(page, page.getByText('Roles', { exact: true }), page.getByTestId('expiry-panel-expiry'))

const offerDialog = (page: Page) =>
  around(page, page.getByTestId('offer-name-confirm-view'), page.getByTestId('offer-name-confirm'))

const offerPending = (page: Page) =>
  bannerOf(
    page,
    page.getByText('Offer pending', { exact: true }),
    page.getByRole('button', { name: 'Withdraw offer' }),
  )

const offerTo = async (page: Page, recipient: number) => {
  await page.getByTestId('role-action-offer-name').click()
  await page.getByTestId('send-name-search-input').fill(ACCOUNTS[recipient].address)
  await page.getByTestId(`search-result-${ACCOUNTS[recipient].address}`).click()
  await expect(page.getByTestId('offer-name-confirm')).toBeEnabled()
}

test('offering a name and withdrawing the offer', async ({ page, app }) => {
  const label = 'offeredname'
  await register(label, HOLDER)
  await app.open(`/${label}.${TLD}?tab=ownership`, { as: [HOLDER] })
  await offerTo(page, RECIPIENT)
  await matchScreenshot(offerDialog(page), 'offer.png')
  await page.getByTestId('offer-name-confirm').click()
  await matchScreenshot(await transactionDialog(page), 'offer-confirm.png')
  await completeTransactions(page)
  expect(await offeredTo(label)).toBe(ACCOUNTS[RECIPIENT].address)
  expect(await holderOf(label)).toBe(ACCOUNTS[HOLDER].address)

  await matchScreenshot(offerPending(page), 'offer-pending.png')
  await page.getByRole('button', { name: 'Withdraw offer' }).click()
  await matchScreenshot(await transactionDialog(page), 'withdraw-confirm.png')
  await completeTransactions(page)
  expect(await offeredTo(label)).toBeUndefined()
  await expect(page.getByText('Offer pending', { exact: true })).toHaveCount(0)
})

test('relaying an offer and its withdrawal for a temporary owner', async ({ page, app }) => {
  const label = 'relayedname'
  const holder = ACCOUNTS[TEMPORARY_OWNER].address
  await register(label, TEMPORARY_OWNER)
  await setAllowance(SELECTED, 1000)
  const { typedData } = await app.open(`/${label}.${TLD}?tab=ownership`, {
    as: [SELECTED, TEMPORARY_OWNER],
  })
  await offerTo(page, OTHER)
  await expect(page.getByText(`Your wallet asks ${holder}`)).toBeVisible()
  await matchScreenshot(offerDialog(page), 'relayed-offer.png')
  await page.getByTestId('offer-name-confirm').click()
  await matchScreenshot(await transactionDialog(page), 'relayed-offer-confirm.png')
  await completeTransactions(page)
  expect(await offeredTo(label)).toBe(ACCOUNTS[OTHER].address)

  await matchScreenshot(offerPending(page), 'relayed-offer-pending.png')
  await page.getByRole('button', { name: 'Withdraw offer' }).click()
  await matchScreenshot(await transactionDialog(page), 'relayed-withdraw-confirm.png')
  await completeTransactions(page)
  expect(await offeredTo(label)).toBeUndefined()
  expect(typedData.map(({ signer, typedData: { primaryType } }) => [signer, primaryType])).toEqual([
    [holder, 'ApproveName'],
    [holder, 'ApproveName'],
  ])
})

test('claiming a name in its dispute period', async ({ page, app }) => {
  const label = 'claimedname'
  await setAllowance(HOLDER, 1000)
  await registerWithAllowance(label, HOLDER, DISPUTE_DAYS)
  await offer(label, HOLDER, RECIPIENT)
  await app.open(`/${label}.${TLD}`, { as: [RECIPIENT] })
  const claim = page.getByRole('button', { name: 'Review and claim' })
  await matchScreenshot(
    bannerOf(page, page.getByText(`${label}.${TLD} has been offered to you`), claim),
    'claim-banner.png',
  )
  await claim.click()
  const confirm = page.getByTestId('claim-name-confirm')
  const dialog = around(page, page.getByTestId('claim-name-view'), confirm)
  await expect(page.getByTestId('terms-text')).toBeVisible()
  await expect(page.getByTestId('claim-name-acknowledge-dispute')).toBeVisible()
  await matchScreenshot(dialog, 'claim.png')
  await page.getByTestId('claim-name-acknowledge-dispute').check()
  await page.getByTestId('terms-accept').check()
  await expect(confirm).toBeEnabled()
  await matchScreenshot(dialog, 'claim-accepted.png')
  await confirm.click()
  await matchScreenshot(await transactionDialog(page), 'claim-confirm.png')
  await completeTransactions(page, { count: 2 })
  expect(await holderOf(label)).toBe(ACCOUNTS[RECIPIENT].address)

  await app.goto(`/${label}.${TLD}?tab=ownership`)
  await expect(page.getByTestId('expiry-panel-dispute-period')).toBeVisible()
  await matchScreenshot(ownershipPanel(page), 'claimed-ownership.png')
})

test('extending a name as its holder', async ({ page, app }) => {
  const label = 'extendedname'
  await register(label, HOLDER)
  const expiry = await expiryOf(label)
  await app.open(`/${label}.${TLD}?tab=ownership`, { as: [HOLDER] })
  await page.getByTestId('expiry-action-extend').click()
  const confirm = page.getByTestId('extend-names-confirm')
  const dialog = around(page, page.getByTestId('extend-names-modal'), confirm)
  await expect(page.getByTestId('terms-text')).toBeVisible()
  await matchScreenshot(dialog, 'extend-terms.png')
  await page.getByTestId('terms-accept').check()
  await expect(confirm).toBeEnabled()
  const total = page.getByTestId('extend-names-modal').getByTestId('invoice-total')
  await total.scrollIntoViewIfNeeded()
  await expect(total).toBeVisible()
  await matchScreenshot(dialog, 'extend.png')
  await confirm.click()
  await matchScreenshot(await transactionDialog(page), 'extend-confirm.png')
  await completeTransactions(page, { count: 2 })
  expect(await expiryOf(label)).toBe(expiry + 365n * 86400n)
})

test('extending a name in its dispute period', async ({ page, app }) => {
  const label = 'disputedname'
  await setAllowance(HOLDER, 1000)
  await registerWithAllowance(label, HOLDER, DISPUTE_DAYS)
  await app.open(`/${label}.${TLD}?tab=ownership`, { as: [HOLDER] })
  await expect(page.getByTestId('expiry-panel-dispute-period')).toBeVisible()
  await matchScreenshot(ownershipPanel(page), 'dispute-ownership.png')
  await page.getByTestId('expiry-action-extend').click()
  const confirm = page.getByTestId('extend-names-confirm')
  await expect(page.getByTestId('extend-names-dispute-period')).toBeVisible()
  await expect(confirm).toBeDisabled()
  await matchScreenshot(
    around(page, page.getByTestId('extend-names-modal'), confirm),
    'extend-dispute-period.png',
  )
})

test('a renewal link opened by a non-holder', async ({ page, app }) => {
  const label = 'renewedname'
  await register(label, HOLDER)
  await app.open('/', { as: [RECIPIENT] })
  await app.goto(`/${label}.${TLD}?renew=31536000`)
  const warning = page.getByText('Connect the wallet that holds this name to extend it.')
  await expect(warning).toBeVisible()
  await expect(page.getByTestId('extend-names-modal')).toHaveCount(0)
  await matchScreenshot(around(page, warning, page.locator('svg')), 'renew-link-non-holder.png')
})
