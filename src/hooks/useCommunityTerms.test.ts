import { mockFunction, renderHook } from '@app/test-utils'

import { labelhash } from 'viem'
import { readContract } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigWithEns } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'

import {
  getAcceptedClaimTermsQueryFn,
  getCommittedTermsQueryFn,
  getListedTermsQueryFn,
  useCommunityTerms,
} from './useCommunityTerms'

vi.mock('viem/actions')
vi.mock('@app/utils/query/useQuery')
vi.mock('./useQueryOptions', () => ({
  useQueryOptions: () => ({ queryKey: ['getListedTerms'], queryFn: vi.fn() }),
}))
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => NAME_POLICY,
}))

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const TERMS = `0x${'77'.repeat(32)}` as const
const COMMITMENT = `0x${'cc'.repeat(32)}` as const

const mockReadContract = vi.mocked(readContract)
const mockUseQuery = mockFunction(useQuery)
const config = { getClient: () => ({}) } as unknown as ConfigWithEns

type QueryResult = { data?: unknown; isLoading?: boolean; isFetching?: boolean }
const listing = (result: QueryResult) => mockUseQuery.mockReturnValue(result as never)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCommunityTerms', () => {
  it('shows the terms of a listed name as the name policy keeps them', () => {
    listing({ data: { termsHash: TERMS, text: 'the terms' } })
    const { result } = renderHook(() => useCommunityTerms({ name: 'alice.testing' }))
    expect(result.current).toMatchObject({
      isListed: true,
      termsHash: TERMS,
      text: 'the terms',
      hasTerms: true,
    })
  })

  it('has no terms to accept for a listed name before the first setTerms', () => {
    listing({ data: { termsHash: `0x${'00'.repeat(32)}`, text: '' } })
    expect(
      renderHook(() => useCommunityTerms({ name: 'alice.testing' })).result.current,
    ).toMatchObject({ isListed: true, hasTerms: false })
  })

  it('is not listed without a listing', () => {
    listing({ data: null })
    expect(
      renderHook(() => useCommunityTerms({ name: 'alice.testing' })).result.current,
    ).toMatchObject({ isListed: false, hasTerms: false })
  })

  it('waits for the listing, and reports a listing refetch', () => {
    listing({ isLoading: true })
    expect(
      renderHook(() => useCommunityTerms({ name: 'alice.testing' })).result.current.isLoading,
    ).toBe(true)
    listing({ data: null, isLoading: false, isFetching: true })
    expect(
      renderHook(() => useCommunityTerms({ name: 'alice.testing' })).result.current,
    ).toMatchObject({
      isLoading: false,
      isFetching: true,
    })
  })
})

describe('getListedTermsQueryFn', () => {
  const getListing = (name: string) =>
    getListedTermsQueryFn(config)({
      queryKey: [{ name }, 1337, undefined, undefined, 'getListedTerms'],
    } as never)

  it("reads a 2LD's listing and the current terms, hash and text, from the name policy", async () => {
    mockReadContract
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(TERMS)
      .mockResolvedValueOnce('the terms')
    expect(await getListing('alice.testing')).toEqual({ termsHash: TERMS, text: 'the terms' })
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: NAME_POLICY,
        functionName: 'communityNames',
        args: [labelhash('alice')],
      }),
    )
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: NAME_POLICY, functionName: 'termsText' }),
    )
  })

  it('returns nothing for an unlisted name and reads nothing for a subname', async () => {
    mockReadContract
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(TERMS)
      .mockResolvedValueOnce('the terms')
    expect(await getListing('alice.testing')).toBeNull()
    mockReadContract.mockClear()
    expect(await getListing('mobile.alice.testing')).toBeNull()
    expect(mockReadContract).not.toHaveBeenCalled()
  })
})

describe('getCommittedTermsQueryFn', () => {
  const getCommittedTerms = (acceptor?: `0x${string}`) =>
    getCommittedTermsQueryFn(config)({
      queryKey: [{ commitment: COMMITMENT }, 1337, acceptor, undefined, 'getCommittedTerms'],
    } as never)

  it("reads the connected account's acceptance for the commitment", async () => {
    mockReadContract.mockResolvedValueOnce(TERMS)
    expect(await getCommittedTerms(RECIPIENT)).toBe(TERMS)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: NAME_POLICY,
        functionName: 'acceptedTerms',
        args: [COMMITMENT, RECIPIENT],
      }),
    )
  })

  it('reads nothing without a connected account', async () => {
    expect(await getCommittedTerms()).toBeNull()
    expect(mockReadContract).not.toHaveBeenCalled()
  })
})

describe('getAcceptedClaimTermsQueryFn', () => {
  const getAcceptedClaimTerms = (
    holder?: `0x${string}`,
    recipient?: `0x${string}`,
    offerNumber?: bigint,
  ) =>
    getAcceptedClaimTermsQueryFn(config)({
      queryKey: [
        { name: 'alice.testing', holder, offerNumber },
        1337,
        recipient,
        undefined,
        'getAcceptedClaimTerms',
      ],
    } as never)

  it("reads the recipient's acceptance for the reviewed offer", async () => {
    mockReadContract.mockResolvedValueOnce(TERMS)
    expect(await getAcceptedClaimTerms(HOLDER, RECIPIENT, 3n)).toBe(TERMS)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: NAME_POLICY,
        functionName: 'acceptedClaimTerms',
        args: [BigInt(labelhash('alice')), HOLDER, RECIPIENT, 3n],
      }),
    )
  })

  it('reads nothing without a holder, an offer or a connected recipient', async () => {
    expect(await getAcceptedClaimTerms(undefined, RECIPIENT, 3n)).toBeNull()
    expect(await getAcceptedClaimTerms(HOLDER, undefined, 3n)).toBeNull()
    expect(await getAcceptedClaimTerms(HOLDER, RECIPIENT)).toBeNull()
    expect(mockReadContract).not.toHaveBeenCalled()
  })
})
