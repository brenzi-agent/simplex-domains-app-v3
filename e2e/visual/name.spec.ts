import { type Page } from '@playwright/test'
import { zeroAddress } from 'viem'

import { SIMPLEX_LINK_SEPARATOR } from '@app/constants/simplex'

import {
  accountOf,
  advance,
  createSubname,
  expiryOf,
  latestTimestamp,
  ONE_DAY,
  register,
  setText,
  subnameHolderOf,
  textOf,
  TLD,
  type User,
} from './chain'
import {
  closeTransactionDialog,
  completeTransactions,
  expect,
  matchCompleteStage,
  matchDialog,
  matchScreen,
  matchTransactionDialog,
  showTab,
  test,
  transactionDialog,
} from './fixtures'

const HOLDER: User = 'user2'
const LABEL = 'holdername'
const NAME = `${LABEL}.${TLD}`
const CONTACTS = [
  'https://smp4.simplex.im/a#visualtestcontactlinkaaaaaaaaaaaaaaaaaaaaaaaa',
  'https://smp5.simplex.im/a#visualtestcontactlinkbbbbbbbbbbbbbbbbbbbbbbbb',
]
const CHANNEL = 'https://smp6.simplex.im/c#visualtestchannellinkcccccccccccccccccccccccc'
const SECOND_CHANNEL = 'https://smp7.simplex.im/c#visualtestchannellinkdddddddddddddddddddddddd'
const GRACE_PERIOD_DAYS = 90n

const seedName = async () => {
  await register(LABEL, HOLDER)
  await setText(NAME, HOLDER, 'simplex.contact', CONTACTS.join(SIMPLEX_LINK_SEPARATOR))
  await setText(NAME, HOLDER, 'simplex.channel', CHANNEL)
  await createSubname(NAME, 'mobile', HOLDER)
}

const advancePastExpiry = async (days: bigint) =>
  advance((await expiryOf(LABEL)) - (await latestTimestamp()) + days * ONE_DAY)

const matchTabs = async (page: Page, visitor: string) => {
  await expect(page.getByTestId('profile-section-simplex')).toContainText('SimpleX Channel')
  await matchScreen(page, `${visitor}-profile.png`)

  await showTab(page, 'Records')
  await expect(page.getByTestId('text-amount')).toHaveText(/^2 /)
  await matchScreen(page, `${visitor}-records.png`)

  await showTab(page, 'Ownership')
  await expect(page.getByTestId('expiry-panel-grace-period')).toBeVisible()
  await matchScreen(page, `${visitor}-ownership.png`)

  await showTab(page, 'Subnames')
  await expect(page.getByTestId(`name-item-mobile.${NAME}`)).toBeVisible()
  await matchScreen(page, `${visitor}-subnames.png`)

  await showTab(page, 'More')
  await expect(page.getByText('Resolver', { exact: true })).toBeVisible()
  await matchScreen(page, `${visitor}-more.png`)
}

test('name page of the holder', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}`, { accounts: [HOLDER] })
  await expect(page.getByTestId('profile-actions')).toBeVisible()
  await matchTabs(page, 'holder')
})

test('name page of a visitor', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}`)
  await expect(page.getByTestId('profile-actions')).toHaveCount(0)
  await matchTabs(page, 'visitor')
  await expect(page.getByRole('button', { name: 'Edit Records' })).toHaveCount(0)
  await expect(page.getByTestId('add-subname-action')).toHaveCount(0)
})

test('name page in its grace period', async ({ page, app }) => {
  await seedName()
  await advancePastExpiry(1n)
  await app.open(`/${NAME}`, { accounts: [HOLDER] })
  await expect(page.getByTestId('profile-section-simplex')).toContainText('SimpleX Channel')
  await matchScreen(page, 'grace-period-profile.png')
  await showTab(page, 'Ownership')
  await expect(page.getByTestId('expiry-panel-grace-period')).toBeVisible()
  await matchScreen(page, 'grace-period-ownership.png')
})

test('name page after its grace period', async ({ page, app }) => {
  await seedName()
  await advancePastExpiry(GRACE_PERIOD_DAYS + 1n)
  await app.open(`/${NAME}`, { accounts: [HOLDER] })
  await expect(page.getByText(`Register ${NAME}`, { exact: true })).toBeVisible()
  await expect(page.getByTestId('public-sales-closed')).toBeVisible()
  await matchScreen(page, 'expired.png')
})

test('editing the SimpleX links', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}`, { accounts: [HOLDER] })
  await page.getByTestId('profile-action-Edit profile').click()
  const editor = page.getByTestId('profile-editor')
  await expect(editor.getByTestId('multi-url-field-simplex.contact-input-1')).toHaveValue(
    CONTACTS[1],
  )
  await expect(editor.getByTestId('multi-url-field-simplex.channel-add')).toHaveCount(0)
  await editor.getByTestId('multi-url-field-simplex.channel-input-0').fill(SECOND_CHANNEL)
  await matchDialog(page, 'editor')
  await page.getByTestId('profile-submit-button').click()
  await matchTransactionDialog(page, 'editor-confirm')
  await completeTransactions(page)
  await matchCompleteStage(page, 'editor-complete')
  await closeTransactionDialog(page)
  expect(await textOf(NAME, 'simplex.channel')).toBe(SECOND_CHANNEL)
  expect(await textOf(NAME, 'simplex.contact')).toBe(CONTACTS.join(SIMPLEX_LINK_SEPARATOR))
  await expect(page.getByTestId('profile-section-simplex')).toContainText('smp7.simplex.im')
  await matchScreen(page, 'edited-profile.png')
})

test('editing a record in the advanced editor', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}?tab=records`, { accounts: [HOLDER] })
  await page.getByRole('button', { name: 'Edit Records' }).click()
  const channel = page
    .getByTestId('advanced-editor')
    .getByTestId('record-input-simplex.channel')
    .getByTestId('record-input-input')
  await expect(channel).toHaveValue(CHANNEL)
  await channel.fill(SECOND_CHANNEL)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await matchDialog(page, 'advanced-editor')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await matchTransactionDialog(page, 'advanced-editor-confirm')
  await completeTransactions(page)
  await matchCompleteStage(page, 'advanced-editor-complete')
  await closeTransactionDialog(page)
  expect(await textOf(NAME, 'simplex.channel')).toBe(SECOND_CHANNEL)
  await expect(page.locator('div[data-testid="records-tab"]')).toContainText(SECOND_CHANNEL)
  await matchScreen(page, 'edited-records.png')
})

test('creating, listing and deleting a subname', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}?tab=subnames`, { accounts: [HOLDER] })
  await page.getByTestId('add-subname-action').click()
  await page.getByTestId('add-subname-input').fill('shop')
  await expect(page.getByTestId('create-subname-next')).toBeEnabled()
  await matchDialog(page, 'subname-create')
  await page.getByTestId('create-subname-next').click()
  await page.getByTestId('multi-url-field-simplex.contact-input-0').fill(CONTACTS[0])
  await matchDialog(page, 'subname-profile')
  await page.getByTestId('create-subname-profile-next').click()
  await matchTransactionDialog(page, 'subname-create-confirm')
  await completeTransactions(page, 2)
  await expect(transactionDialog(page)).toBeHidden()
  expect(await subnameHolderOf(`shop.${NAME}`)).toBe(accountOf(HOLDER).address)
  expect(await textOf(`shop.${NAME}`, 'simplex.contact')).toBe(CONTACTS[0])
  await expect(page.getByTestId('profile-snippet-name')).toHaveText(`shop.${NAME}`)
  await matchScreen(page, 'subname-created.png')

  await app.goto(`/${NAME}?tab=subnames`)
  await expect(page.getByTestId(`name-item-shop.${NAME}`)).toBeVisible()
  await matchScreen(page, 'subnames-listed.png')

  await app.goto(`/mobile.${NAME}`)
  await page.getByTestId('profile-action-Delete subname').click()
  await matchTransactionDialog(page, 'subname-delete-confirm')
  await completeTransactions(page)
  await matchCompleteStage(page, 'subname-delete-complete')
  await closeTransactionDialog(page)
  expect(await subnameHolderOf(`mobile.${NAME}`)).toBe(zeroAddress)
})
