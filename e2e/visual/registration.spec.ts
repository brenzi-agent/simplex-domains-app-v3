import { type Page } from '@playwright/test'

import { ACCOUNTS, advance, holderOf, setAllowance, setPublicSalesOpen, textOf, TLD } from './chain'
import { around, completeTransactions, expect, test, transactionDialog } from './fixtures'

const BUYER = 1
const PARTNER = 1
const TEMPORARY_OWNER = 2
const CONTACT = 'https://smp4.simplex.im/a#visualtestcontactlinkaaaaaaaaaaaaaaaaaaaaaaaa'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

const pricingCard = (page: Page, label: string) =>
  around(
    page,
    page.getByText(`Register ${label}.${TLD}`, { exact: true }),
    page.getByTestId('next-button'),
  )

const infoCard = (page: Page) =>
  around(page, page.getByText('Before we start', { exact: true }), page.getByTestId('next-button'))

const transactionsCard = (page: Page, action: string) =>
  around(page, page.getByText('Almost there', { exact: true }), page.getByTestId(action))

const completeCard = (page: Page) =>
  around(page, page.getByText('Congratulations!', { exact: true }), page.getByTestId('view-name'))

const waitOutCommitment = async (page: Page, app: { syncClock: () => Promise<void> }) => {
  await expect(page.getByTestId('wait-button')).toBeVisible()
  await advance(60n)
  await app.syncClock()
}

test('registration on the payable path under the general terms', async ({ page, app }) => {
  const label = 'freshname'
  await app.open(`/${label}.${TLD}/register`, { as: [BUYER] })
  await expect(page.getByTestId('terms-text')).toBeVisible()
  await expect(page.getByTestId('invoice-total')).toBeVisible()
  await expect(page.getByTestId('next-button')).toHaveText('Accept the terms to continue')
  await expect(pricingCard(page, label)).toHaveScreenshot('pricing-general-terms.png')

  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('next-button')).toHaveText('Next')
  await expect(pricingCard(page, label)).toHaveScreenshot('pricing-terms-accepted.png')
  await page.getByTestId('next-button').click()

  await page.getByTestId('multi-url-field-simplex.contact-input-0').fill(CONTACT)
  const profile = around(
    page,
    page.getByText('Create your profile', { exact: true }),
    page.getByTestId('profile-submit-button'),
  )
  await expect(profile).toHaveScreenshot('profile.png')
  await page.getByTestId('profile-submit-button').click()

  await expect(page.getByTestId('invoice-total')).toBeVisible()
  await expect(infoCard(page)).toHaveScreenshot('info.png')
  await page.getByTestId('next-button').click()

  await expect(await transactionDialog(page)).toHaveScreenshot('commit-confirm.png')
  await page.getByTestId('close-icon').click()
  await expect(page.getByTestId('start-timer-button')).toBeEnabled()
  await expect(transactionsCard(page, 'start-timer-button')).toHaveScreenshot('commit.png')
  await page.getByTestId('start-timer-button').click()
  await completeTransactions(page, { autoClose: true })

  await expect(transactionsCard(page, 'wait-button')).toHaveScreenshot('wait.png')
  await waitOutCommitment(page, app)
  await expect(page.getByTestId('finish-button')).toBeEnabled()
  await expect(transactionsCard(page, 'finish-button')).toHaveScreenshot('register.png')
  await page.getByTestId('finish-button').click()
  await expect(await transactionDialog(page)).toHaveScreenshot('register-confirm.png')
  await completeTransactions(page, { autoClose: true })

  await expect(page.getByTestId('invoice-item-expiry-date')).toBeVisible()
  await expect(completeCard(page)).toHaveScreenshot('complete.png')
  expect(await holderOf(label)).toBe(ACCOUNTS[BUYER].address)
  expect(await textOf(`${label}.${TLD}`, 'simplex.contact')).toBe(CONTACT)
})

test('pricing under the community terms', async ({ page, app }) => {
  const label = 'communityname'
  await app.open(`/${label}.${TLD}/register`, { as: [BUYER] })
  await expect(page.getByTestId('terms-text')).toContainText('community', { ignoreCase: true })
  await expect(page.getByTestId('invoice-total')).toBeVisible()
  await expect(pricingCard(page, label)).toHaveScreenshot('pricing-community-terms.png')
})

test('pricing while public sales are closed', async ({ page, app }) => {
  await setPublicSalesOpen(false)
  await app.open(`/freshname.${TLD}/register`, { as: [BUYER] })
  const closed = page.getByTestId('public-sales-closed')
  await expect(closed).toContainText('Public sales are not open yet')
  await expect(
    around(page, page.getByText(`Register freshname.${TLD}`, { exact: true }), closed),
  ).toHaveScreenshot('pricing-sales-closed.png')
})

test('registration from a registrar allowance', async ({ page, app }) => {
  const label = 'partnername'
  await setAllowance(PARTNER, 1000)
  await app.open(`/${label}.${TLD}/register`, { as: [PARTNER] })
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('next-button')).toHaveText('Register with allowance')
  await expect(page.getByText('$900.00')).toBeVisible()
  await expect(pricingCard(page, label)).toHaveScreenshot('allowance-pricing.png')
  await page.getByTestId('next-button').click()
  await page.getByTestId('profile-submit-button').click()

  await expect(page.getByTestId('next-button')).toBeEnabled()
  await expect(infoCard(page)).toHaveScreenshot('allowance-info.png')
  await page.getByTestId('next-button').click()
  await completeTransactions(page, { autoClose: true })
  await waitOutCommitment(page, app)
  await page.getByTestId('finish-button').click()
  await completeTransactions(page, { autoClose: true })

  await expect(page.getByTestId('invoice-item-0-amount-usd')).toHaveText('$100.00')
  await expect(completeCard(page)).toHaveScreenshot('allowance-complete.png')
  expect(await holderOf(label)).toBe(ACCOUNTS[PARTNER].address)
})

test('registration from an allowance that is too low', async ({ page, app }) => {
  const label = 'partnername'
  await setAllowance(PARTNER, 10)
  await app.open(`/${label}.${TLD}/register`, { as: [PARTNER] })
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId('next-button')).toHaveText('Allowance too low')
  await expect(page.getByText('-$90.00')).toBeVisible()
  await expect(pricingCard(page, label)).toHaveScreenshot('allowance-too-low.png')
})

test('registration from an allowance to a temporary owner', async ({ page, app }) => {
  const label = 'ownername'
  const owner = ACCOUNTS[TEMPORARY_OWNER].address
  await setAllowance(PARTNER, 1000)
  const { typedData } = await app.open(`/${label}.${TLD}/register`, {
    as: [PARTNER, TEMPORARY_OWNER],
  })
  await page.getByTestId('terms-accept').check()
  await expect(page.getByTestId(`owner-${owner}`)).toBeVisible()
  await expect(pricingCard(page, label)).toHaveScreenshot('owner-choice.png')
  await page.getByTestId(`owner-${owner}`).click()
  await page.getByTestId('next-button').click()
  await page.getByTestId('profile-submit-button').click()

  await expect(page.getByText(`Your wallet first asks ${owner}`)).toBeVisible()
  await expect(page.getByTestId('next-button')).toBeEnabled()
  await expect(infoCard(page)).toHaveScreenshot('owner-info.png')
  await page.getByTestId('next-button').click()
  await expect(await transactionDialog(page)).toHaveScreenshot('owner-commit-confirm.png')
  expect(typedData.map(({ signer, typedData: { primaryType } }) => [signer, primaryType])).toEqual([
    [owner, 'AcceptGeneralTerms'],
    [owner, 'RegisterName'],
  ])
  expect(JSON.stringify(typedData, null, 2)).toMatchSnapshot('owner-typed-data.json')
  await completeTransactions(page, { autoClose: true })
  await waitOutCommitment(page, app)
  await page.getByTestId('finish-button').click()
  await expect(await transactionDialog(page)).toHaveScreenshot('owner-register-confirm.png')

  await page.route('**/_next/static/chunks/pages/profile-*.js', () => {})
  await completeTransactions(page, { autoClose: true })
  await expect(page.getByText(`${label}.${TLD} is registered to ${owner}.`)).toBeVisible()
  await expect(completeCard(page)).toHaveScreenshot('owner-complete.png')
  expect(await holderOf(label)).toBe(owner)
})

test.describe('phone', () => {
  test.use(PHONE)

  test('pricing', async ({ page, app }) => {
    const label = 'freshname'
    await app.open(`/${label}.${TLD}/register`, { as: [BUYER] })
    await page.getByTestId('terms-accept').check()
    await expect(page.getByTestId('invoice-total')).toBeVisible()
    await expect(pricingCard(page, label)).toHaveScreenshot('phone-pricing.png')
  })
})
