import { mockFunction } from '@app/test-utils'

import {
  Address,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  HttpRequestError,
  namehash,
  RpcRequestError,
  zeroAddress,
} from 'viem'
import { readContract } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigWithEns } from '@app/types'

import { getConnectedHolder, getNameOfferQueryFn } from './useNameOffer'

vi.mock('viem/actions')
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))

const mockReadContract = mockFunction(readContract)

const REGISTRAR = '0x1111111111111111111111111111111111111111'
const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'

const mockConfig = { getClient: () => ({}) } as unknown as ConfigWithEns

const getNameOffer = (name: string, address?: Address) =>
  getNameOfferQueryFn(mockConfig)({
    queryKey: [{ name }, 1337, address, undefined, 'getNameOffer'],
  } as never)

const chain = (approved: Address, tld = 'testing') =>
  mockReadContract.mockImplementation(
    (async (_: unknown, { functionName }: { functionName: string }) =>
      ({ baseNode: namehash(tld), ownerOf: HOLDER, offers: 3n })[functionName] ?? approved) as never,
  )

describe('getNameOfferQueryFn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for a subname, another TLD or a name known only by its labelhash', async () => {
    expect(await getNameOffer('mobile.alice.testing')).toBeNull()
    expect(await getNameOffer('alice.simplex')).toBeNull()
    expect(await getNameOffer(`[${'ab'.repeat(32)}].testing`)).toBeNull()
    expect(mockReadContract).not.toHaveBeenCalled()
  })

  it('returns null for a name without a holder', async () => {
    mockReadContract.mockRejectedValueOnce(
      new ContractFunctionRevertedError({ abi: [], functionName: 'ownerOf', data: '0x' }),
    )
    expect(await getNameOffer('alice.testing')).toBeNull()
    mockReadContract.mockRejectedValueOnce(new ExecutionRevertedError())
    expect(await getNameOffer('alice.testing')).toBeNull()
  })

  it('rethrows a failed request instead of reporting no holder', async () => {
    mockReadContract.mockRejectedValueOnce(new HttpRequestError({ url: 'http://rpc' }))
    await expect(getNameOffer('alice.testing')).rejects.toThrow(HttpRequestError)
    mockReadContract.mockRejectedValueOnce(
      new RpcRequestError({ body: {}, error: { code: -32005, message: 'rate limited' }, url: '' }),
    )
    await expect(getNameOffer('alice.testing')).rejects.toThrow(RpcRequestError)
  })

  it('returns null when the registrar serves another TLD than the name', async () => {
    chain(RECIPIENT, 'simplex')
    expect(await getNameOffer('alice.testing', RECIPIENT)).toBeNull()
  })

  it('returns the holder and no recipient when nothing is offered', async () => {
    chain(zeroAddress)
    expect(await getNameOffer('alice.testing', HOLDER)).toEqual({
      holder: HOLDER,
      recipient: undefined,
      offerNumber: 3n,
      isHolder: true,
      isRecipient: false,
    })
  })

  it('marks the recipient, in any letter case', async () => {
    chain(RECIPIENT)
    expect(await getNameOffer('alice.testing', RECIPIENT.toUpperCase() as Address)).toEqual({
      holder: HOLDER,
      recipient: RECIPIENT,
      offerNumber: 3n,
      isHolder: false,
      isRecipient: true,
    })
    expect(await getNameOffer('alice.testing')).toMatchObject({
      isHolder: false,
      isRecipient: false,
    })
  })
})

describe('getConnectedHolder', () => {
  const SELECTED = '0x4444444444444444444444444444444444444444'
  const heldBy = (isHolder: boolean) => ({ holder: HOLDER, isHolder })

  it('is the selected account that holds the name, without a relay', () => {
    expect(
      getConnectedHolder({ offer: heldBy(true), addresses: [HOLDER], allowance: 0n }),
    ).toEqual({ isConnectedHolder: true, relayedHolder: undefined })
  })

  it('is another connected account that holds the name, relayed by a selected account with an allowance', () => {
    expect(
      getConnectedHolder({
        offer: heldBy(false),
        addresses: [SELECTED, HOLDER.toUpperCase() as Address],
        allowance: 1n,
      }),
    ).toEqual({ isConnectedHolder: true, relayedHolder: HOLDER.toUpperCase() })
  })

  it.each([
    ['the selected account has no allowance', [SELECTED, HOLDER], 0n],
    ['the allowance is not read yet', [SELECTED, HOLDER], undefined],
    ['no connected account holds the name', [SELECTED], 1n],
  ] as const)('is none when %s', (_, addresses, allowance) => {
    expect(getConnectedHolder({ offer: heldBy(false), addresses, allowance })).toEqual({
      isConnectedHolder: false,
      relayedHolder: undefined,
    })
  })

  it('is none for a name without a holder', () => {
    expect(getConnectedHolder({ offer: null, addresses: [SELECTED], allowance: 1n })).toEqual({
      isConnectedHolder: false,
      relayedHolder: undefined,
    })
  })
})
