import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  test as base,
  expect,
  type Frame,
  type Locator,
  type Page,
  type Request,
  type Route,
} from '@playwright/test'
import { isAddress, isAddressEqual, type Address, type TypedDataDefinition } from 'viem'

import { injectHeadlessWeb3Provider, Web3RequestKind } from '@ensdomains/headless-web3-provider'

import {
  accountOf,
  APP_URL,
  chain,
  keyOf,
  latestTimestamp,
  resetChain,
  RPC_URL,
  type User,
} from './chain'

const LOCAL_ORIGINS = [new URL(APP_URL).origin, new URL(RPC_URL).origin]
const RPC_FALLBACK_HOSTS = ['lb.drpc.org', 'mainnet.gateway.tenderly.co']
const DNS_OVER_HTTPS = 'https://1.1.1.1/dns-query'
const NXDOMAIN = { Status: 3, TC: false, RD: true, RA: true, AD: true, CD: false }
const SCREENSHOT_CSS = join(__dirname, 'screenshot.css')
const WHOLE_PAGE_CSS = join(__dirname, 'whole-page.css')
const LASTING_SCREEN_MS = 3_000
const RPC_QUIET_MS = 500
const RPC_POLL_MS = 100
const TRANSACTION_SUCCESSFUL = 'Transaction Successful'
export const TERMS_TITLE = 'SimpleX Names Conditions of Use'
export const USER_REJECTED = 'User rejected the request.'
const USER_REJECTION = { code: 4001, message: USER_REJECTED }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type TermsFile = { file: string; contentType: string }

const parseTermsFiles = (json: unknown) => {
  if (!isRecord(json)) throw new Error('terms.json: not an object')
  return new Map(
    Object.entries(json).map(([url, entry]): [string, TermsFile] => {
      if (
        !isRecord(entry) ||
        typeof entry.file !== 'string' ||
        typeof entry.contentType !== 'string'
      )
        throw new Error(`terms.json: ${url} has no file and content type`)
      return [url, { file: entry.file, contentType: entry.contentType }]
    }),
  )
}

const TERMS_FILES = parseTermsFiles(
  JSON.parse(readFileSync(join(__dirname, 'chain', 'terms.json'), 'utf8')),
)

const isRpc = (url: URL) =>
  url.origin === new URL(RPC_URL).origin || RPC_FALLBACK_HOSTS.includes(url.host)

const serveExternal = async (route: Route) => {
  const request = route.request()
  const url = new URL(request.url())
  const terms = TERMS_FILES.get(request.url())
  if (terms)
    return route.fulfill({
      contentType: terms.contentType,
      body: readFileSync(join(__dirname, 'chain', terms.file)),
    })
  if (isRpc(url)) return route.fulfill({ response: await route.fetch({ url: RPC_URL }) })
  if (`${url.origin}${url.pathname}` === DNS_OVER_HTTPS)
    return route.fulfill({
      contentType: 'application/dns-json',
      json: { ...NXDOMAIN, Question: [{ name: url.searchParams.get('name'), type: 1 }] },
    })
  return route.abort('blockedbyclient')
}

type SignedTypedData = {
  signer: Address
  typedData: TypedDataDefinition<Record<string, unknown>, string>
}

export type Wallet = { accounts: readonly [User, ...User[]]; connected?: boolean }

type RefusableRequest = Web3RequestKind.SendTransaction | Web3RequestKind.SignTypedDataV4

const parseTypedData = (json: string): SignedTypedData['typedData'] => {
  const { domain, types, primaryType, message }: Partial<Record<string, unknown>> = JSON.parse(json)
  if (
    !isRecord(domain) ||
    !isRecord(types) ||
    typeof primaryType !== 'string' ||
    !isRecord(message)
  )
    throw new Error(`not EIP-712 typed data: ${json}`)
  const { name, version, chainId, verifyingContract } = domain
  if (
    typeof name !== 'string' ||
    typeof version !== 'string' ||
    typeof chainId !== 'number' ||
    typeof verifyingContract !== 'string' ||
    !isAddress(verifyingContract)
  )
    throw new Error(`not an EIP-712 domain: ${json}`)
  const { EIP712Domain, ...messageTypes } = types
  return {
    domain: { name, version, chainId, verifyingContract },
    types: messageTypes,
    primaryType,
    message,
  }
}

const parseSignRequest = (params: unknown) => {
  const [from, json] = Array.isArray(params) ? params : []
  if (typeof from !== 'string' || !isAddress(from) || typeof json !== 'string')
    throw new Error(`eth_signTypedData_v4 without an address and typed data: ${params}`)
  return { from, typedData: parseTypedData(json) }
}

const injectWallet = async (page: Page, users: Wallet['accounts']) => {
  const typedData: SignedTypedData[] = []
  let refusal: RefusableRequest | undefined
  const wallet = await injectHeadlessWeb3Provider({
    page,
    privateKeys: users.map(keyOf),
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
    if (req.method === refusal) {
      refusal = undefined
      return Promise.reject(USER_REJECTION)
    }
    if (req.method !== Web3RequestKind.SignTypedDataV4) return request(req)
    const { from, typedData: signed } = parseSignRequest(req.params)
    const signer = users.map(accountOf).find(({ address }) => isAddressEqual(address, from))
    if (!signer) throw new Error(`the wallet holds no account ${from}`)
    typedData.push({ signer: signer.address, typedData: signed })
    return signer.signTypedData(signed)
  }
  return {
    typedData,
    refuse: (refused: RefusableRequest) => {
      refusal = refused
    },
  }
}

export const connectButton = (page: Page) =>
  page.locator(
    '[data-testid="connect-button"]:visible, [data-testid="tabbar-connect-button"]:visible',
  )

export const walletOption = (page: Page, isMobile: boolean) =>
  page.getByTestId(
    isMobile ? 'rk-wallet-option-injected' : 'rk-wallet-option-headless-web3-provider',
  )

const connect = async (page: Page, isMobile: boolean) => {
  await connectButton(page).click()
  await walletOption(page, isMobile).click()
  await expect(connectButton(page)).toHaveCount(0)
}

type RpcActivity = { pending: number; lastActivity: number }

const rpcActivities = new WeakMap<Page, RpcActivity>()

const trackRpcActivity = (page: Page) => {
  const activity: RpcActivity = { pending: 0, lastActivity: 0 }
  rpcActivities.set(page, activity)
  page.on('request', (request) => {
    if (!isRpc(new URL(request.url()))) return
    activity.pending += 1
    activity.lastActivity = Date.now()
  })
  const settle = (request: Request) => {
    if (!isRpc(new URL(request.url()))) return
    activity.pending -= 1
    activity.lastActivity = Date.now()
  }
  page.on('requestfinished', settle)
  page.on('requestfailed', settle)
}

const rpcSettled = async (page: Page) => {
  const activity = rpcActivities.get(page)
  if (!activity) throw new Error('the page was not opened by the app fixture')
  const since = Date.now()
  await expect
    .poll(() => (activity.pending ? 0 : Date.now() - Math.max(since, activity.lastActivity)), {
      intervals: [RPC_POLL_MS],
    })
    .toBeGreaterThanOrEqual(RPC_QUIET_MS)
}

export type App = {
  open: (path: string, wallet?: Wallet) => ReturnType<typeof injectWallet>
  goto: (path: string) => Promise<void>
  syncClock: () => Promise<void>
}

export const test = base.extend<{ app: App }>({
  app: async ({ page, isMobile }, use) => {
    await resetChain()
    const context = page.context()
    await context.route((url) => !LOCAL_ORIGINS.includes(url.origin), serveExternal)
    await context.routeWebSocket(/.*/, () => {})
    trackRpcActivity(page)
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
        const injected = wallet
          ? await injectWallet(page, wallet.accounts)
          : { typedData: [], refuse: () => {} }
        await page.goto(path)
        if (wallet && (wallet.connected ?? true)) await connect(page, isMobile)
        return injected
      },
    })
  },
})

const matchAtTop = async (
  page: Page,
  name: string,
  options: { fullPage?: boolean; mask: Locator[]; stylePath?: string[] },
) => {
  await rpcSettled(page)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    if (document.body.style.position === 'fixed') document.body.style.top = '0px'
  })
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot(name, options)
}

export const matchScreen = (page: Page, name: string, mask: Locator[] = []) =>
  matchAtTop(page, name, { fullPage: true, mask, stylePath: [SCREENSHOT_CSS, WHOLE_PAGE_CSS] })

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

const scrollDialog = (page: Page, edge: 'top' | 'end') =>
  page.evaluate((to) => {
    const dialog = [...document.querySelectorAll('body > div.modal, [role="dialog"]')].at(-1)
    const dialogBody = [...(dialog?.querySelectorAll('*') ?? [])].find((element) => {
      const { overflowY } = getComputedStyle(element)
      return (
        ['auto', 'scroll'].includes(overflowY) &&
        element.scrollHeight > element.clientHeight + 1 &&
        element.getAttribute('data-testid') !== 'terms-text'
      )
    })
    if (!dialogBody) return false
    dialogBody.scrollTop = to === 'top' ? 0 : dialogBody.scrollHeight
    return true
  }, edge)

export const matchDialog = async (page: Page, name: string, mask: Locator[] = []) => {
  const scrollable = await scrollDialog(page, 'top')
  await matchAtTop(page, `${name}.png`, { mask })
  if (scrollable) {
    await scrollDialog(page, 'end')
    await matchAtTop(page, `${name}-end.png`, { mask })
  }
}

export const acceptTerms = async (page: Page) => {
  await page.getByTestId('terms-accept').dispatchEvent('click')
  await expect(page.getByTestId('terms-accept')).toBeChecked()
}

export const scrollTermsToEnd = (page: Page) =>
  page.getByTestId('terms-text').evaluate((terms) => terms.scrollTo(0, terms.scrollHeight))

const transactionConfirm = (page: Page) => page.getByTestId('transaction-modal-confirm-button')

const transactionDone = (page: Page) => page.getByTestId('transaction-modal-complete-button')

export const transactionDialog = (page: Page) => page.getByTestId('transaction-modal-inner')

export const networkFeeEstimated = (page: Page) =>
  expect(page.getByTestId('invoice-item-1-amount')).toHaveText(/[1-9]/)

const toast = (page: Page) =>
  page.locator('[data-testid="toast-desktop"], [data-testid="toast-touch"]')

export const matchTransactionDialog = async (page: Page, name: string, mask: Locator[] = []) => {
  await expect(transactionConfirm(page)).toBeEnabled()
  await matchDialog(page, name, mask)
}

const confirmTransaction = async (page: Page) => {
  await expect(transactionConfirm(page)).toBeEnabled()
  await transactionConfirm(page).click()
  await expect(toast(page)).toContainText(TRANSACTION_SUCCESSFUL)
  await toast(page).getByText(TRANSACTION_SUCCESSFUL).click()
  await page.getByTestId('toast-close-icon').click()
  await expect(toast(page)).toHaveCount(0)
}

export const completeTransactions = async (page: Page, count = 1): Promise<void> => {
  await confirmTransaction(page)
  if (count === 1) return
  await transactionDone(page).click()
  return completeTransactions(page, count - 1)
}

export const refuseTransaction = async (page: Page) => {
  await expect(transactionConfirm(page)).toBeEnabled()
  await transactionConfirm(page).click()
  await expect(transactionDialog(page)).toContainText(USER_REJECTED)
}

export const matchCompleteStage = async (page: Page, name: string) => {
  await expect(transactionDone(page)).toBeVisible()
  await matchDialog(page, name)
}

export const closeTransactionDialog = async (page: Page) => {
  await transactionDone(page).click()
  await expect(transactionDialog(page)).toBeHidden()
}

export const showTab = async (page: Page, tab: string) => {
  await page.getByRole('button', { name: tab, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`))
}

export { expect }
