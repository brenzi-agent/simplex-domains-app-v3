import { type Page } from '@playwright/test'

import {
  ACCOUNTS,
  expiryOf,
  holderOf,
  offer,
  offeredTo,
  ONE_DAY,
  register,
  registerWithAllowance,
  setAllowance,
  TLD,
} from './chain'
import {
  completeTransactions,
  expect,
  matchDialog,
  matchScreen,
  matchTransactionDialog,
  test,
} from './fixtures'

const HOLDER = 1
const RECIPIENT = 2
const SELECTED = 1
const TEMPORARY_OWNER = 2
const OTHER = 3
const ONE_YEAR = 365n * ONE_DAY
const TERMS_TITLE = 'SimpleX Names Conditions of Use'

const offerTo = async (page: Page, recipient: number) => {
  await page.getByTestId('role-action-offer-name').click()
  await page.getByTestId('send-name-search-input').fill(ACCOUNTS[recipient].address)
  await page.getByTestId(`search-result-${ACCOUNTS[recipient].address}`).click()
  await expect(page.getByTestId('offer-name-confirm')).toBeEnabled()
}

const withdrawOffer = (page: Page) => page.getByRole('button', { name: 'Withdraw offer' })

const openClaim = async (page: Page, label: string, screens: string) => {
  await expect(page.getByText(`${label}.${TLD} has been offered to you`)).toBeVisible()
  await matchScreen(page, `${screens}-banner.png`)
  await page.getByRole('button', { name: 'Review and claim' }).click()
  await expect(page.getByTestId('terms-text')).toContainText(TERMS_TITLE)
  await matchDialog(page, screens)
}

const claim = async (page: Page, label: string, screens: string) => {
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('claim-name-confirm')).toBeEnabled()
  await matchDialog(page, `${screens}-accepted`)
  await page.getByTestId('claim-name-confirm').click()
  await matchTransactionDialog(page, `${screens}-confirm`)
  await completeTransactions(page, { count: 2 })
  expect(await holderOf(label)).toBe(ACCOUNTS[RECIPIENT].address)
}

const extendAsHolder = async (page: Page, label: string, screens: string) => {
  const expiry = await expiryOf(label)
  await expect(page.getByTestId('terms-text')).toContainText(TERMS_TITLE)
  await matchDialog(page, `${screens}-terms`)
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('extend-names-confirm')).toBeEnabled()
  await expect(page.getByTestId('extend-names-modal').getByTestId('invoice-total')).toBeVisible()
  await matchDialog(page, screens)
  await page.getByTestId('extend-names-confirm').click()
  await matchTransactionDialog(page, `${screens}-confirm`)
  await completeTransactions(page, { count: 2 })
  expect(await expiryOf(label)).toBe(expiry + ONE_YEAR)
}

test('offering a name and withdrawing the offer', async ({ page, app }) => {
  const label = 'offeredname'
  await register(label, HOLDER)
  await app.open(`/${label}.${TLD}?tab=ownership`, { accounts: [HOLDER] })
  await offerTo(page, RECIPIENT)
  await matchDialog(page, 'offer')
  await page.getByTestId('offer-name-confirm').click()
  await matchTransactionDialog(page, 'offer-confirm')
  await completeTransactions(page)
  expect(await offeredTo(label)).toBe(ACCOUNTS[RECIPIENT].address)
  expect(await holderOf(label)).toBe(ACCOUNTS[HOLDER].address)

  await expect(page.getByText('Offer pending', { exact: true })).toBeVisible()
  await matchScreen(page, 'offer-pending.png')
  await withdrawOffer(page).click()
  await matchTransactionDialog(page, 'withdraw-confirm')
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
    accounts: [SELECTED, TEMPORARY_OWNER],
  })
  await offerTo(page, OTHER)
  await expect(page.getByText(`Your wallet asks ${holder}`)).toBeVisible()
  await matchDialog(page, 'relayed-offer')
  await page.getByTestId('offer-name-confirm').click()
  await matchTransactionDialog(page, 'relayed-offer-confirm')
  await completeTransactions(page)
  expect(await offeredTo(label)).toBe(ACCOUNTS[OTHER].address)

  await expect(page.getByText('Offer pending', { exact: true })).toBeVisible()
  await matchScreen(page, 'relayed-offer-pending.png')
  await withdrawOffer(page).click()
  await matchTransactionDialog(page, 'relayed-withdraw-confirm')
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
  await registerWithAllowance(label, HOLDER)
  await offer(label, HOLDER, RECIPIENT)
  await app.open(`/${label}.${TLD}`, { accounts: [RECIPIENT] })
  await openClaim(page, label, 'dispute-claim')
  await page.getByTestId('claim-name-acknowledge-dispute').check()
  await matchDialog(page, 'dispute-claim-acknowledged')
  await claim(page, label, 'dispute-claim')

  await app.goto(`/${label}.${TLD}?tab=ownership`)
  await expect(page.getByTestId('expiry-panel-dispute-period')).toBeVisible()
  await matchScreen(page, 'dispute-claimed-ownership.png')
})

test('claiming a name without a dispute period', async ({ page, app }) => {
  const label = 'claimedname'
  await register(label, HOLDER)
  await offer(label, HOLDER, RECIPIENT)
  await app.open(`/${label}.${TLD}`, { accounts: [RECIPIENT] })
  await openClaim(page, label, 'claim')
  await expect(page.getByTestId('claim-name-acknowledge-dispute')).toHaveCount(0)
  await claim(page, label, 'claim')

  await app.goto(`/${label}.${TLD}?tab=ownership`)
  await expect(page.getByTestId('expiry-panel-expiry')).toBeVisible()
  await expect(page.getByTestId('expiry-panel-dispute-period')).toHaveCount(0)
  await matchScreen(page, 'claimed-ownership.png')
})

test('claiming a community name', async ({ page, app }) => {
  const label = 'communityclaim'
  await register(label, HOLDER)
  await offer(label, HOLDER, RECIPIENT)
  await app.open(`/${label}.${TLD}`, { accounts: [RECIPIENT] })
  await openClaim(page, label, 'community-claim')
  await claim(page, label, 'community-claim')
})

test('extending a name as its holder', async ({ page, app }) => {
  const label = 'extendedname'
  await register(label, HOLDER)
  await app.open(`/${label}.${TLD}?tab=ownership`, { accounts: [HOLDER] })
  await page.getByTestId('expiry-action-extend').click()
  await extendAsHolder(page, label, 'extend')
})

test('extending a community name as its holder', async ({ page, app }) => {
  const label = 'communityname'
  await register(label, HOLDER)
  await app.open(`/${label}.${TLD}?tab=ownership`, { accounts: [HOLDER] })
  await page.getByTestId('expiry-action-extend').click()
  await extendAsHolder(page, label, 'community-extend')
})

test('extending a name in its dispute period', async ({ page, app }) => {
  const label = 'disputedname'
  await setAllowance(HOLDER, 1000)
  await registerWithAllowance(label, HOLDER)
  await app.open(`/${label}.${TLD}?tab=ownership`, { accounts: [HOLDER] })
  await expect(page.getByTestId('expiry-panel-dispute-period')).toBeVisible()
  await matchScreen(page, 'dispute-ownership.png')
  await page.getByTestId('expiry-action-extend').click()
  await expect(page.getByTestId('extend-names-dispute-period')).toBeVisible()
  await expect(page.getByTestId('extend-names-confirm')).toBeDisabled()
  await matchDialog(page, 'extend-dispute-period')
})

test('a renewal link opened by the holder', async ({ page, app }) => {
  const label = 'renewedname'
  await register(label, HOLDER)
  await app.open(`/${label}.${TLD}?renew=31536000`, { accounts: [HOLDER] })
  await expect(page.getByTestId('extend-names-modal')).toBeVisible()
  await extendAsHolder(page, label, 'renew-link')
})

test('a renewal link opened by a non-holder', async ({ page, app }) => {
  const label = 'renewedname'
  await register(label, HOLDER)
  await app.open(`/${label}.${TLD}?renew=31536000`, { accounts: [RECIPIENT] })
  await expect(
    page.getByText('Connect the wallet that holds this name to extend it.'),
  ).toBeVisible()
  await expect(page.getByTestId('extend-names-modal')).toHaveCount(0)
  await matchScreen(page, 'renew-link-non-holder.png')
})
