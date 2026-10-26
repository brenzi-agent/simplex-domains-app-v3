import { mockFunction, renderHook } from '@app/test-utils'

import { labelhash } from 'viem'
import { readContract } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigWithEns } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'

import {
  getAcceptedClaimTermsQueryFn,
  getBonaFideListingQueryFn,
  getCommittedTermsQueryFn,
  useBonaFideTerms,
} from './useBonaFideTerms'

vi.mock('viem/actions')
vi.mock('@app/utils/query/useQuery')
vi.mock('./useQueryOptions', () => ({
  useQueryOptions: () => ({ queryKey: ['getBonaFideListing'], queryFn: vi.fn() }),
}))
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({
    SimplexNamePolicy: NAME_POLICY,
    BaseRegistrarImplementation: REGISTRAR,
  }),
}))

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const REGISTRAR = '0x1111111111111111111111111111111111111111'
const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const TERMS = `0x${'77'.repeat(32)}` as const
const COMMITMENT = `0x${'cc'.repeat(32)}` as const

const mockReadContract = vi.mocked(readContract)
const mockUseQuery = mockFunction(useQuery)
const config = { getClient: () => ({}) } as unknown as ConfigWithEns

type QueryResult = { data?: unknown; isLoading?: boolean; isFetching?: boolean }
const queries = (listing: QueryResult, terms: QueryResult = {}) =>
  mockUseQuery.mockImplementation(((options: { queryKey: unknown[] }) =>
    options.queryKey[0] === 'bonaFideTerms' ? terms : listing) as never)

describe('useBonaFideTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the bundled terms of a listed name only when they hash to the terms on chain', () => {
    queries({ data: { isListed: true, termsHash: TERMS } }, { data: { text: 'the terms', hash: TERMS } })
    const { result } = renderHook(() => useBonaFideTerms({ name: 'alice.simplex' }))
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['bonaFideTerms', '/bona-fide-terms.simplex.md'], enabled: true }),
    )
    expect(result.current).toMatchObject({ isListed: true, text: 'the terms', matches: true })

    queries({ data: { isListed: true, termsHash: TERMS } }, { data: { text: 'old', hash: `0x${'88'.repeat(32)}` } })
    expect(renderHook(() => useBonaFideTerms({ name: 'alice.simplex' })).result.current.matches).toBe(false)
  })

  it('fetches no terms for an unlisted name and reads nothing without a name', () => {
    queries({ data: { isListed: false, termsHash: TERMS } })
    renderHook(() => useBonaFideTerms({ name: 'alice.simplex' }))
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['bonaFideTerms', '/bona-fide-terms.simplex.md'], enabled: false }),
    )
    renderHook(() => useBonaFideTerms({}))
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['getBonaFideListing'], enabled: false }),
    )
  })

  it('waits for the listing and for the terms text, and reports a listing refetch', () => {
    queries({ isLoading: true })
    expect(renderHook(() => useBonaFideTerms({ name: 'alice.simplex' })).result.current.isLoading).toBe(true)
    queries({ data: { isListed: true, termsHash: TERMS } }, { isLoading: true })
    expect(renderHook(() => useBonaFideTerms({ name: 'alice.simplex' })).result.current.isLoading).toBe(true)
    queries({ data: { isListed: false, termsHash: TERMS }, isFetching: true })
    expect(renderHook(() => useBonaFideTerms({ name: 'alice.simplex' })).result.current).toMatchObject({
      isLoading: false,
      isFetching: true,
    })
  })
})

describe('getBonaFideListingQueryFn', () => {
  const getListing = (name: string) =>
    getBonaFideListingQueryFn(config)({
      queryKey: [{ name }, 1337, undefined, undefined, 'getBonaFideListing'],
    } as never)

  it("reads a 2LD's listing and the current terms from the name policy", async () => {
    mockReadContract.mockResolvedValueOnce(true).mockResolvedValueOnce(TERMS)
    expect(await getListing('alice.simplex')).toEqual({ isListed: true, termsHash: TERMS })
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ address: NAME_POLICY, functionName: 'bonaFideNames', args: [labelhash('alice')] }),
    )
  })

  it('reads nothing for a subname', async () => {
    mockReadContract.mockClear()
    expect(await getListing('mobile.alice.simplex')).toBeNull()
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
      expect.objectContaining({ address: NAME_POLICY, functionName: 'acceptedTerms', args: [COMMITMENT, RECIPIENT] }),
    )
  })

  it('reads nothing without a connected account', async () => {
    mockReadContract.mockClear()
    expect(await getCommittedTerms()).toBeNull()
    expect(mockReadContract).not.toHaveBeenCalled()
  })
})

describe('getAcceptedClaimTermsQueryFn', () => {
  const getAcceptedClaimTerms = (holder?: `0x${string}`, recipient?: `0x${string}`) =>
    getAcceptedClaimTermsQueryFn(config)({
      queryKey: [{ name: 'alice.testing', holder }, 1337, recipient, undefined, 'getAcceptedClaimTerms'],
    } as never)

  it("reads the recipient's acceptance for the holder's current offer", async () => {
    mockReadContract.mockResolvedValueOnce(3n).mockResolvedValueOnce(TERMS)
    expect(await getAcceptedClaimTerms(HOLDER, RECIPIENT)).toBe(TERMS)
    const tokenId = BigInt(labelhash('alice'))
    expect(mockReadContract).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ address: REGISTRAR, functionName: 'offers', args: [tokenId] }),
    )
    expect(mockReadContract).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        address: NAME_POLICY,
        functionName: 'acceptedClaimTerms',
        args: [tokenId, HOLDER, RECIPIENT, 3n],
      }),
    )
  })

  it('reads nothing without a holder or a connected recipient', async () => {
    mockReadContract.mockClear()
    expect(await getAcceptedClaimTerms(undefined, RECIPIENT)).toBeNull()
    expect(await getAcceptedClaimTerms(HOLDER, undefined)).toBeNull()
    expect(mockReadContract).not.toHaveBeenCalled()
  })
})
