import { type Page } from '@playwright/test'

import { register, TLD, type User } from './chain'
import { expect, matchScreen, test } from './fixtures'

const HOLDER: User = 'user2'

const searchBox = (page: Page, isMobile: boolean) =>
  page.getByTestId(isMobile ? 'search-input-box-fake' : 'search-input-box')

const typeSearch = async (page: Page, isMobile: boolean, input: string) => {
  await searchBox(page, isMobile).click()
  await page.getByTestId('search-input-box').fill(input)
}

const search = async (page: Page, isMobile: boolean, input: string, status: string) => {
  await typeSearch(page, isMobile, input)
  const [name, tld] = [0, 1].map((row) => page.getByTestId('search-result-name').nth(row))
  await expect(name).toContainText(`${input}.${TLD}`)
  await expect(name).toContainText(status)
  await expect(tld).toContainText('Not Supported')
}

test('home page', async ({ page, app, isMobile }) => {
  await app.open('/')
  await expect(searchBox(page, isMobile)).toBeVisible()
  await matchScreen(page, 'home.png')
})

for (const { input, status, screenshot } of [
  { input: 'freshname', status: 'Available', screenshot: 'available.png' },
  { input: 'simplex-chat', status: 'Reserved', screenshot: 'reserved.png' },
  { input: 'short', status: 'Min 6 chars', screenshot: 'too-short.png' },
  { input: 'communityname', status: 'Available', screenshot: 'community.png' },
]) {
  test(`search for ${input}`, async ({ page, app, isMobile }) => {
    await app.open('/')
    await search(page, isMobile, input, status)
    await matchScreen(page, screenshot)
  })
}

test('search for a registered name', async ({ page, app, isMobile }) => {
  await register('heldname', HOLDER)
  await app.open('/')
  await search(page, isMobile, 'heldname', 'Registered')
  await matchScreen(page, 'registered.png')
})

test('search for an invalid name', async ({ page, app, isMobile }) => {
  await app.open('/')
  await typeSearch(page, isMobile, 'my_name')
  await expect(page.getByTestId('search-result-error')).toHaveText('Invalid name')
  await matchScreen(page, 'invalid.png')
})
