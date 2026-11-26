import { register, TLD } from './chain'
import { around, expect, test } from './fixtures'

const HOLDER = 1

test('home page', async ({ page, app }) => {
  await app.open('/')
  const home = around(
    page,
    page.getByRole('heading', { name: 'Your SimpleX name' }),
    page.getByTestId('search-input-box'),
  )
  await expect(home).toHaveScreenshot('home.png')
})

for (const { input, status, screenshot } of [
  { input: 'freshname', status: 'Available', screenshot: 'available.png' },
  { input: 'heldname', status: 'Registered', screenshot: 'registered.png' },
  { input: 'simplex-chat', status: 'Reserved', screenshot: 'reserved.png' },
  { input: 'short', status: 'Min 6 chars', screenshot: 'too-short.png' },
  { input: 'communityname', status: 'Available', screenshot: 'community.png' },
]) {
  test(`search for ${input}`, async ({ page, app }) => {
    await register('heldname', HOLDER)
    await app.open('/')
    await page.getByTestId('search-input-box').fill(input)
    const result = page.getByTestId('search-result-name').first()
    await expect(result).toContainText(`${input}.${TLD}`)
    await expect(result).toContainText(status)
    await expect(page.getByTestId('search-input-results')).toHaveScreenshot(screenshot)
  })
}

test('search for an invalid name', async ({ page, app }) => {
  await app.open('/')
  await page.getByTestId('search-input-box').fill('my_name')
  await expect(page.getByTestId('search-result-error')).toHaveText('Invalid name')
  await expect(page.getByTestId('search-input-results')).toHaveScreenshot('invalid.png')
})
