import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import {
  test as base,
  expect,
  type Frame,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test'
import { isAddressEqual, type Address, type TypedDataDefinition } from 'viem'

import { injectHeadlessWeb3Provider, Web3RequestKind } from '@ensdomains/headless-web3-provider'

import { ACCOUNTS, APP_URL, chain, KEYS, latestTimestamp, resetChain, RPC_URL } from './chain'

const LOCAL_ORIGINS = [new URL(APP_URL).origin, new URL(RPC_URL).origin]
const TERMS_ORIGIN = 'https://raw.githubusercontent.com'
const DNS_OVER_HTTPS = 'https://1.1.1.1/dns-query'
const NXDOMAIN = { Status: 3, TC: false, RD: true, RA: true, AD: true, CD: false }
const LASTING_SCREEN_MS = 3_000

const serveExternal = (route: Route) => {
  const url = new URL(route.request().url())
  if (url.origin === TERMS_ORIGIN)
    return route.fulfill({
      contentType: 'text/markdown; charset=utf-8',
      body: readFileSync(join(__dirname, 'chain', 'terms', basename(url.pathname))),
    })
  if (`${url.origin}${url.pathname}` === DNS_OVER_HTTPS)
    return route.fulfill({
      contentType: 'application/dns-json',
      json: { ...NXDOMAIN, Question: [{ name: url.searchParams.get('name'), type: 1 }] },
    })
  return route.abort('blockedbyclient')
}

export type SignedTypedData = { signer: Address; typedData: TypedDataDefinition }

export type Wallet = { accounts: readonly [number, ...number[]]; connected?: boolean }

const injectWallet = async (page: Page, accounts: Wallet['accounts']) => {
  const typedData: SignedTypedData[] = []
  const wallet = await injectHeadlessWeb3Provider({
    page,
    privateKeys: accounts.map((account) => KEYS[account]),
    chains: [chain],
    permitted: [
      Web3RequestKind.RequestPermissions,
      Web3RequestKind.RequestAccounts,
      Web3RequestKind.SendTransaction,
      Web3RequestKind.SignTypedDataV4,
    ],
  })
  const request = wallet.request.bind(wallet)
  wallet.request = async (req) => {
    if (req.method !== 'eth_signTypedData_v4') return request(req)
    const [from, json] = req.params as readonly [Address, string]
    const signer = accounts
      .map((account) => ACCOUNTS[account])
      .find((account) => isAddressEqual(account.address, from))
    if (!signer) throw new Error(`the wallet holds no account ${from}`)
    const { types, ...definition } = JSON.parse(json)
    const { EIP712Domain, ...messageTypes } = types
    const signed = { ...definition, types: messageTypes } as TypedDataDefinition
    typedData.push({ signer: signer.address, typedData: signed })
    return signer.signTypedData(signed)
  }
  return typedData
}

export const connectButton = (page: Page) =>
  page.locator(
    '[data-testid="connect-button"]:visible, [data-testid="tabbar-connect-button"]:visible',
  )

const connect = async (page: Page) => {
  await connectButton(page).click()
  await page.getByText('Headless Web3 Provider').click()
  await expect(connectButton(page)).toHaveCount(0)
}

type App = {
  open: (path: string, wallet?: Wallet) => Promise<{ typedData: SignedTypedData[] }>
  goto: (path: string) => Promise<void>
  syncClock: () => Promise<void>
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await resetChain()
    const context = page.context()
    await context.route((url) => !LOCAL_ORIGINS.includes(url.origin), serveExternal)
    await context.routeWebSocket(/.*/, () => {})
    const syncClock = async () =>
      page.clock.setFixedTime(new Date(Number(await latestTimestamp()) * 1000))
    await use({
      syncClock,
      goto: async (path) => {
        await syncClock()
        await page.goto(path)
      },
      open: async (path, wallet) => {
        await syncClock()
        const typedData = wallet ? await injectWallet(page, wallet.accounts) : []
        await page.goto(path)
        if (wallet && (wallet.connected ?? true)) await connect(page)
        return { typedData }
      },
    })
  },
})

export const matchScreen = async (page: Page, name: string, mask: Locator[] = []) => {
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot(name, { mask })
}

export const matchLastingScreen = async (page: Page, name: string) => {
  await matchScreen(page, name)
  const navigations: string[] = []
  const recordNavigation = (frame: Frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url())
  }
  page.on('framenavigated', recordNavigation)
  await page.waitForTimeout(LASTING_SCREEN_MS)
  page.off('framenavigated', recordNavigation)
  expect(navigations).toEqual([])
  await matchScreen(page, name)
}

const scrollDialogToEnd = (page: Page) =>
  page.evaluate(() => {
    const isInFixedLayer = (element: Element | null): boolean =>
      !!element &&
      (getComputedStyle(element).position === 'fixed' || isInFixedLayer(element.parentElement))
    const dialogBody = [...document.querySelectorAll('body *')].find((element) => {
      const { overflowY } = getComputedStyle(element)
      return (
        ['auto', 'scroll'].includes(overflowY) &&
        element.scrollHeight > element.clientHeight + 1 &&
        element.getAttribute('data-testid') !== 'terms-text' &&
        isInFixedLayer(element)
      )
    })
    if (!dialogBody) return false
    dialogBody.scrollTop = dialogBody.scrollHeight
    return true
  })

export const matchDialog = async (page: Page, name: string) => {
  await matchScreen(page, `${name}.png`)
  if (await scrollDialogToEnd(page)) await matchScreen(page, `${name}-end.png`)
}

export const transactionConfirm = (page: Page) =>
  page.getByTestId('transaction-modal-confirm-button')

export const matchTransactionDialog = async (page: Page, name: string) => {
  await expect(transactionConfirm(page)).toBeEnabled()
  await matchDialog(page, name)
}

export const completeTransactions = async (
  page: Page,
  { count = 1, autoClose = false }: { count?: number; autoClose?: boolean } = {},
): Promise<void> => {
  await expect(transactionConfirm(page)).toBeEnabled()
  await transactionConfirm(page).click()
  if (count > 1 || !autoClose) await page.getByTestId('transaction-modal-complete-button').click()
  if (count > 1) return completeTransactions(page, { count: count - 1, autoClose })
  await expect(page.getByTestId('transaction-modal-inner')).toBeHidden()
}

export const showTab = async (page: Page, tab: string) => {
  await page.getByRole('button', { name: tab, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`))
}

export { expect }
