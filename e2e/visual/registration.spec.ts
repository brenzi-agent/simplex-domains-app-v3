import { type Page } from '@playwright/test'
import { type Hex } from 'viem'

import {
  ACCOUNTS,
  advance,
  committedAt,
  holderOf,
  setAllowance,
  setPublicSalesOpen,
  textOf,
  TLD,
} from './chain'
import {
  completeTransactions,
  expect,
  matchLastingScreen,
  matchScreen,
  matchTransactionDialog,
  test,
} from './fixtures'

const BUYER = 1
const PARTNER = 1
const TEMPORARY_OWNER = 2
const CONTACT = 'https://smp4.simplex.im/a#visualtestcontactlinkaaaaaaaaaaaaaaaaaaaaaaaa'

type App = { syncClock: () => Promise<void> }

const waitOutCommitment = async (page: Page, app: App) => {
  await expect(page.getByTestId('wait-button')).toBeVisible()
  await advance(60n)
  await app.syncClock()
}

const registerOnPayablePath = async (page: Page, app: App, label: string, terms: string) => {
  await expect(page.getByTestId('terms-text')).toContainText('SimpleX Names Conditions of Use')
  await expect(page.getByTestId('invoice-total')).toBeVisible()
  await expect(page.getByTestId('next-button')).toHaveText('Accept the terms to continue')
  await matchScreen(page, `${terms}-pricing.png`)

  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('next-button')).toHaveText('Next')
  await matchScreen(page, `${terms}-pricing-accepted.png`)
  await page.getByTestId('next-button').click()

  await page.getByTestId('multi-url-field-simplex.contact-input-0').fill(CONTACT)
  await matchScreen(page, `${terms}-profile.png`)
  await page.getByTestId('profile-submit-button').click()

  await expect(page.getByTestId('invoice-total')).toBeVisible()
  await expect(page.getByTestId('invoice-item-1-amount')).not.toHaveText('0 ETH')
  await matchScreen(page, `${terms}-info.png`)
  await page.getByTestId('next-button').click()

  await matchTransactionDialog(page, `${terms}-commit-confirm`)
  await page.getByTestId('close-icon').click()
  await expect(page.getByTestId('start-timer-button')).toBeEnabled()
  await matchScreen(page, `${terms}-commit.png`)
  await page.getByTestId('start-timer-button').click()
  await completeTransactions(page, { autoClose: true })

  await expect(page.getByTestId('wait-button')).toBeVisible()
  await app.syncClock()
  await expect(page.getByTestId('countdown-circle')).toHaveText('60')
  await matchScreen(page, `${terms}-wait.png`)
  await waitOutCommitment(page, app)
  await expect(page.getByTestId('finish-button')).toBeEnabled()
  await matchScreen(page, `${terms}-register.png`, [page.getByTestId('countdown-circle')])
  await page.getByTestId('finish-button').click()
  await matchTransactionDialog(page, `${terms}-register-confirm`)
  await completeTransactions(page, { autoClose: true })

  await expect(page.getByTestId('invoice-item-expiry-date')).toBeVisible()
  await matchLastingScreen(page, `${terms}-complete.png`)
  expect(await holderOf(label)).toBe(ACCOUNTS[BUYER].address)
  expect(await textOf(`${label}.${TLD}`, 'simplex.contact')).toBe(CONTACT)
}

test('registration on the payable path under the general terms', async ({ page, app }) => {
  await setPublicSalesOpen(true)
  await app.open(`/freshname.${TLD}/register`, { accounts: [BUYER] })
  await expect(page.getByText('SimpleX general terms', { exact: true })).toBeVisible()
  await registerOnPayablePath(page, app, 'freshname', 'general')
})

test('registration on the payable path under the community terms', async ({ page, app }) => {
  await setPublicSalesOpen(true)
  await app.open(`/communityname.${TLD}/register`, { accounts: [BUYER] })
  await expect(page.getByText('Community name', { exact: true })).toBeVisible()
  await registerOnPayablePath(page, app, 'communityname', 'community')
})

test('pricing while public sales are closed', async ({ page, app }) => {
  await app.open(`/freshname.${TLD}/register`, { accounts: [BUYER] })
  await expect(page.getByTestId('public-sales-closed')).toContainText(
    'Public sales are not open yet',
  )
  await matchScreen(page, 'sales-closed.png')
})

test('registration from a registrar allowance while sales are closed', async ({ page, app }) => {
  const label = 'partnername'
  await setAllowance(PARTNER, 1000)
  await app.open(`/${label}.${TLD}/register`, { accounts: [PARTNER] })
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('next-button')).toHaveText('Register with allowance')
  await expect(page.getByText('$900.00')).toBeVisible()
  await matchScreen(page, 'allowance-pricing.png')
  await page.getByTestId('next-button').click()
  await matchScreen(page, 'allowance-profile.png')
  await page.getByTestId('profile-submit-button').click()

  await expect(page.getByTestId('next-button')).toBeEnabled()
  await matchScreen(page, 'allowance-info.png')
  await page.getByTestId('next-button').click()
  await matchTransactionDialog(page, 'allowance-commit-confirm')
  await completeTransactions(page, { autoClose: true })
  await waitOutCommitment(page, app)
  await page.getByTestId('finish-button').click()
  await matchTransactionDialog(page, 'allowance-register-confirm')
  await completeTransactions(page, { autoClose: true })

  await expect(page.getByTestId('invoice-item-0-amount-usd')).toHaveText('$100.00')
  await matchLastingScreen(page, 'allowance-complete.png')
  expect(await holderOf(label)).toBe(ACCOUNTS[PARTNER].address)
})

test('registration from an allowance that is too low', async ({ page, app }) => {
  await setAllowance(PARTNER, 10)
  await app.open(`/partnername.${TLD}/register`, { accounts: [PARTNER] })
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('next-button')).toHaveText('Allowance too low')
  await expect(page.getByText('-$90.00')).toBeVisible()
  await matchScreen(page, 'allowance-too-low.png')
})

test('registration from an allowance to a temporary owner', async ({ page, app }) => {
  const label = 'ownername'
  const owner = ACCOUNTS[TEMPORARY_OWNER].address
  await setAllowance(PARTNER, 1000)
  const { typedData } = await app.open(`/${label}.${TLD}/register`, {
    accounts: [PARTNER, TEMPORARY_OWNER],
  })
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId(`owner-${owner}`)).toBeVisible()
  await matchScreen(page, 'owner-choice.png')
  await page.getByTestId(`owner-${owner}`).click()
  await page.getByTestId('next-button').click()
  await page.getByTestId('profile-submit-button').click()

  await expect(page.getByText(`Your wallet first asks ${owner}`)).toBeVisible()
  await expect(page.getByTestId('next-button')).toBeEnabled()
  await matchScreen(page, 'owner-info.png')
  await page.getByTestId('next-button').click()
  await matchTransactionDialog(page, 'owner-commit-confirm')
  expect(typedData.map(({ signer, typedData: { primaryType } }) => [signer, primaryType])).toEqual([
    [owner, 'AcceptGeneralTerms'],
    [owner, 'RegisterName'],
  ])
  const [{ typedData: terms }] = typedData
  expect(
    JSON.stringify(typedData, (key, value) => (key === 'commitment' ? '<random>' : value), 2),
  ).toMatchSnapshot('owner-typed-data.json')
  await completeTransactions(page, { autoClose: true })
  expect(await committedAt(terms.message.commitment as Hex)).toBeGreaterThan(0n)
  await waitOutCommitment(page, app)
  await page.getByTestId('finish-button').click()
  await matchTransactionDialog(page, 'owner-register-confirm')

  await completeTransactions(page, { autoClose: true })
  await expect(page.getByText(`${label}.${TLD} is registered to ${owner}.`)).toBeVisible()
  await matchLastingScreen(page, 'owner-complete.png')
  expect(await holderOf(label)).toBe(owner)
})
