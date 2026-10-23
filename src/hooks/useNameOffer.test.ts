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

import { getNameOfferQueryFn } from './useNameOffer'

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
      ({ baseNode: namehash(tld), ownerOf: HOLDER })[functionName] ?? approved) as never,
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
      isHolder: true,
      isRecipient: false,
    })
  })

  it('marks the recipient, in any letter case', async () => {
    chain(RECIPIENT)
    expect(await getNameOffer('alice.testing', RECIPIENT.toUpperCase() as Address)).toEqual({
      holder: HOLDER,
      recipient: RECIPIENT,
      isHolder: false,
      isRecipient: true,
    })
    expect(await getNameOffer('alice.testing')).toMatchObject({
      isHolder: false,
      isRecipient: false,
    })
  })
})
