import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { test as base, expect, type Locator, type Page, type Route } from '@playwright/test'
import { isAddressEqual, type Address, type TypedDataDefinition } from 'viem'

import { injectHeadlessWeb3Provider, Web3RequestKind } from '@ensdomains/headless-web3-provider'

import { ACCOUNTS, APP_URL, chain, KEYS, latestTimestamp, resetChain, RPC_URL } from './chain'

const LOCAL_ORIGINS = [new URL(APP_URL).origin, new URL(RPC_URL).origin]
const TERMS_ORIGIN = 'https://raw.githubusercontent.com'
const DNS_OVER_HTTPS = 'https://1.1.1.1/dns-query'
const NXDOMAIN = { Status: 3, TC: false, RD: true, RA: true, AD: true, CD: false }

const SEEDED_RANDOMNESS = `(() => {
  const stream = (seed) => {
    let state = seed
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state
    }
  }
  const nextNumber = stream(1)
  const nextByte = stream(2)
  const nextDigit = stream(3)
  Math.random = () => nextNumber() / 4294967296
  crypto.getRandomValues = (array) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = nextByte() >>> 24
    return array
  }
  crypto.randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (Number(c) ^ (nextDigit() & (15 >> (Number(c) / 4)))).toString(16),
    )
})()`

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

export type SignedTypedData = { signer: string; typedData: TypedDataDefinition }

const injectWallet = async (page: Page, accounts: number[]) => {
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

const connect = async (page: Page) => {
  const connectButton = page.locator(
    '[data-testid="connect-button"]:visible, [data-testid="tabbar-connect-button"]:visible',
  )
  await connectButton.click()
  await page.getByText('Headless Web3 Provider').click()
  await expect(connectButton).toHaveCount(0)
}

type Visitor = { as?: number[]; connected?: boolean }

type App = {
  open: (path: string, visitor?: Visitor) => Promise<{ typedData: SignedTypedData[] }>
  goto: (path: string) => Promise<void>
  syncClock: () => Promise<void>
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await resetChain()
    const context = page.context()
    await context.addInitScript(SEEDED_RANDOMNESS)
    await context.route((url) => !LOCAL_ORIGINS.includes(url.origin), serveExternal)
    await context.routeWebSocket(/.*/, (socket) => socket.close())
    const syncClock = async () =>
      page.clock.setFixedTime(new Date(Number(await latestTimestamp()) * 1000))
    await use({
      syncClock,
      goto: async (path) => {
        await syncClock()
        await page.goto(path)
      },
      open: async (path, { as: accounts = [], connected = true } = {}) => {
        await syncClock()
        const typedData = accounts.length ? await injectWallet(page, accounts) : []
        await page.goto(path)
        if (accounts.length && connected) await connect(page)
        return { typedData }
      },
    })
  },
})

export const around = (page: Page, ...landmarks: Locator[]) =>
  landmarks.reduce((scope, landmark) => scope.filter({ has: landmark }), page.locator('*')).last()

export const matchScreenshot = async (target: Locator, name: string) => {
  await target.page().mouse.move(0, 0)
  await expect(target).toHaveScreenshot(name)
}

export const transactionDialog = async (page: Page) => {
  const confirm = page.getByTestId('transaction-modal-confirm-button')
  await expect(confirm).toBeEnabled()
  return around(page, page.getByTestId('transaction-modal-inner'), confirm)
}

export const completeTransactions = async (
  page: Page,
  { count = 1, autoClose = false }: { count?: number; autoClose?: boolean } = {},
): Promise<void> => {
  const confirm = page.getByTestId('transaction-modal-confirm-button')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  if (count > 1 || !autoClose) await page.getByTestId('transaction-modal-complete-button').click()
  if (count > 1) return completeTransactions(page, { count: count - 1, autoClose })
  await expect(page.getByTestId('transaction-modal-inner')).toBeHidden()
}

export { expect }
