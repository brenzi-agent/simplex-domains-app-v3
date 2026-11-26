import { type Page } from '@playwright/test'
import { zeroAddress } from 'viem'

import { ACCOUNTS, createSubname, register, setText, subnameHolderOf, textOf, TLD } from './chain'
import { around, completeTransactions, expect, test, transactionDialog } from './fixtures'

const HOLDER = 1
const LABEL = 'holdername'
const NAME = `${LABEL}.${TLD}`
const CONTACTS = [
  'https://smp4.simplex.im/a#visualtestcontactlinkaaaaaaaaaaaaaaaaaaaaaaaa',
  'https://smp5.simplex.im/a#visualtestcontactlinkbbbbbbbbbbbbbbbbbbbbbbbb',
]
const CHANNEL = 'https://smp6.simplex.im/c#visualtestchannellinkcccccccccccccccccccccccc'
const SECOND_CHANNEL = 'https://smp7.simplex.im/c#visualtestchannellinkdddddddddddddddddddddddd'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

const seedName = async () => {
  await register(LABEL, HOLDER)
  await setText(NAME, HOLDER, 'simplex.contact', CONTACTS.join(';'))
  await setText(NAME, HOLDER, 'simplex.channel', CHANNEL)
  await createSubname(NAME, 'mobile', HOLDER)
}

const showTab = async (page: Page, tab: string) => {
  await page.getByRole('button', { name: tab, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`))
}

const profilePanel = (page: Page) =>
  around(page, page.getByTestId('profile-snippet'), page.getByTestId('profile-section-ownership'))

const recordsPanel = (page: Page) => page.locator('div[data-testid="records-tab"]')

const ownershipPanel = (page: Page) =>
  around(page, page.getByText('Roles', { exact: true }), page.getByTestId('expiry-panel-expiry'))

const subnamesPanel = (page: Page) =>
  around(page, page.getByTestId('add-subname-action'), page.getByTestId(`name-item-mobile.${NAME}`))

const morePanel = (page: Page) =>
  around(page, page.getByText('Token', { exact: true }), page.getByText('Resolver', { exact: true }))

test('name page of the holder', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}`, { as: [HOLDER] })
  await expect(page.getByTestId('profile-section-simplex')).toContainText('SimpleX Channel')
  await expect(page.getByTestId('profile-actions')).toBeVisible()
  await expect(profilePanel(page)).toHaveScreenshot('holder-profile.png')

  await showTab(page, 'Records')
  await expect(page.getByTestId('text-amount')).toHaveText(/^2 /)
  await expect(recordsPanel(page)).toHaveScreenshot('holder-records.png')

  await showTab(page, 'Ownership')
  await expect(page.getByTestId('expiry-panel-grace-period')).toBeVisible()
  await expect(ownershipPanel(page)).toHaveScreenshot('holder-ownership.png')

  await showTab(page, 'Subnames')
  await expect(subnamesPanel(page)).toHaveScreenshot('holder-subnames.png')

  await showTab(page, 'More')
  await expect(morePanel(page)).toHaveScreenshot('holder-more.png')
})

test('name page of a visitor', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}`)
  await expect(page.getByTestId('profile-section-simplex')).toContainText('SimpleX Channel')
  await expect(page.getByTestId('profile-actions')).toHaveCount(0)
  await expect(profilePanel(page)).toHaveScreenshot('visitor-profile.png')

  await showTab(page, 'Ownership')
  await expect(page.getByTestId('expiry-panel-grace-period')).toBeVisible()
  await expect(ownershipPanel(page)).toHaveScreenshot('visitor-ownership.png')
})

test('editing the SimpleX links', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}`, { as: [HOLDER] })
  await page.getByTestId('profile-action-Edit profile').click()
  const editor = page.getByTestId('profile-editor')
  await expect(editor.getByTestId('multi-url-field-simplex.contact-input-1')).toHaveValue(
    CONTACTS[1],
  )
  await expect(editor.getByTestId('multi-url-field-simplex.channel-add')).toHaveCount(0)
  await editor.getByTestId('multi-url-field-simplex.channel-input-0').fill(SECOND_CHANNEL)
  await expect(around(page, editor, page.getByTestId('profile-submit-button'))).toHaveScreenshot(
    'editor.png',
  )
  await page.getByTestId('profile-submit-button').click()
  await expect(await transactionDialog(page)).toHaveScreenshot('editor-confirm.png')
  await completeTransactions(page)
  expect(await textOf(NAME, 'simplex.channel')).toBe(SECOND_CHANNEL)
  expect(await textOf(NAME, 'simplex.contact')).toBe(CONTACTS.join(';'))
  await expect(page.getByTestId('profile-section-simplex')).toContainText('smp7.simplex.im')
  await expect(profilePanel(page)).toHaveScreenshot('edited-profile.png')
})

test('editing a record in the advanced editor', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}?tab=records`, { as: [HOLDER] })
  await page.getByRole('button', { name: 'Edit Records' }).click()
  const editor = page.getByTestId('advanced-editor')
  const channel = editor
    .getByTestId('record-input-simplex.channel')
    .getByTestId('record-input-input')
  await expect(channel).toHaveValue(CHANNEL)
  await channel.fill(SECOND_CHANNEL)
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeEnabled()
  await expect(around(page, editor, save)).toHaveScreenshot('advanced-editor.png')
  await save.click()
  await expect(await transactionDialog(page)).toHaveScreenshot('advanced-editor-confirm.png')
  await completeTransactions(page)
  expect(await textOf(NAME, 'simplex.channel')).toBe(SECOND_CHANNEL)
  await expect(recordsPanel(page)).toContainText(SECOND_CHANNEL)
  await expect(recordsPanel(page)).toHaveScreenshot('edited-records.png')
})

test('creating, listing and deleting a subname', async ({ page, app }) => {
  await seedName()
  await app.open(`/${NAME}?tab=subnames`, { as: [HOLDER] })
  await page.getByTestId('add-subname-action').click()
  await page.getByTestId('add-subname-input').fill('shop')
  const next = page.getByTestId('create-subname-next')
  await expect(next).toBeEnabled()
  await expect(around(page, page.getByTestId('add-subname-input'), next)).toHaveScreenshot(
    'subname-create.png',
  )
  await next.click()
  await page.getByTestId('multi-url-field-simplex.contact-input-0').fill(CONTACTS[0])
  await page.getByTestId('create-subname-profile-next').click()
  await expect(await transactionDialog(page)).toHaveScreenshot('subname-create-confirm.png')
  await completeTransactions(page, { count: 2 })
  expect(await subnameHolderOf(`shop.${NAME}`)).toBe(ACCOUNTS[HOLDER].address)
  expect(await textOf(`shop.${NAME}`, 'simplex.contact')).toBe(CONTACTS[0])
  await expect(page.getByTestId('profile-snippet-name')).toHaveText(`shop.${NAME}`)
  await expect(profilePanel(page)).toHaveScreenshot('subname-created.png')

  await app.goto(`/${NAME}?tab=subnames`)
  await expect(page.getByTestId(`name-item-shop.${NAME}`)).toBeVisible()
  await expect(subnamesPanel(page)).toHaveScreenshot('subnames-listed.png')

  await app.goto(`/mobile.${NAME}`)
  await page.getByTestId('profile-action-Delete subname').click()
  await expect(await transactionDialog(page)).toHaveScreenshot('subname-delete-confirm.png')
  await completeTransactions(page)
  expect(await subnameHolderOf(`mobile.${NAME}`)).toBe(zeroAddress)
})

test.describe('phone', () => {
  test.use(PHONE)

  test('name page of the holder', async ({ page, app }) => {
    await seedName()
    await app.open(`/${NAME}`, { as: [HOLDER] })
    await expect(page.getByTestId('profile-section-simplex')).toContainText('SimpleX Channel')
    await expect(profilePanel(page)).toHaveScreenshot('phone-holder-profile.png')

    await showTab(page, 'Ownership')
    await expect(page.getByTestId('expiry-panel-grace-period')).toBeVisible()
    await expect(ownershipPanel(page)).toHaveScreenshot('phone-holder-ownership.png')
  })
})
