import { mockFunction, renderHook } from '@app/test-utils'

import { labelhash } from 'viem'
import { readContract } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigWithEns } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'

import {
  getAcceptedClaimTermsQueryFn,
  getCommittedTermsQueryFn,
  getListedTermsHashQueryFn,
  useBonaFideTerms,
} from './useBonaFideTerms'

vi.mock('viem/actions')
vi.mock('@app/utils/query/useQuery')
vi.mock('./useQueryOptions', () => ({
  useQueryOptions: () => ({ queryKey: ['getListedTermsHash'], queryFn: vi.fn() }),
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
const queries = (listing: QueryResult, terms: QueryResult = { isLoading: false }) =>
  mockUseQuery.mockImplementation(((options: { queryKey: unknown[] }) =>
    options.queryKey[0] === 'bonaFideTerms' ? terms : listing) as never)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useBonaFideTerms', () => {
  it('shows the bundled terms of a listed name only when they hash to the terms on chain', () => {
    queries({ data: TERMS }, { data: { text: 'the terms', hash: TERMS } })
    const { result } = renderHook(() => useBonaFideTerms({ name: 'alice.testing' }))
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['bonaFideTerms', '/bona-fide-terms.testing.md'],
        enabled: true,
      }),
    )
    expect(result.current).toMatchObject({ isListed: true, text: 'the terms', matches: true })

    queries({ data: TERMS }, { data: { text: 'old', hash: `0x${'88'.repeat(32)}` } })
    expect(
      renderHook(() => useBonaFideTerms({ name: 'alice.testing' })).result.current.matches,
    ).toBe(false)
  })

  it('fetches no terms for an unlisted name', () => {
    queries({ data: null })
    renderHook(() => useBonaFideTerms({ name: 'alice.testing' }))
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['bonaFideTerms', '/bona-fide-terms.testing.md'],
        enabled: false,
      }),
    )
  })

  it('waits for the listing and for the terms text, and reports a listing refetch', () => {
    queries({ isLoading: true })
    expect(
      renderHook(() => useBonaFideTerms({ name: 'alice.testing' })).result.current.isLoading,
    ).toBe(true)
    queries({ data: TERMS }, { isLoading: true })
    expect(
      renderHook(() => useBonaFideTerms({ name: 'alice.testing' })).result.current.isLoading,
    ).toBe(true)
    queries({ data: null, isFetching: true })
    expect(
      renderHook(() => useBonaFideTerms({ name: 'alice.testing' })).result.current,
    ).toMatchObject({
      isLoading: false,
      isFetching: true,
    })
  })
})

describe('getListedTermsHashQueryFn', () => {
  const getListing = (name: string) =>
    getListedTermsHashQueryFn(config)({
      queryKey: [{ name }, 1337, undefined, undefined, 'getListedTermsHash'],
    } as never)

  it("reads a 2LD's listing and the current terms from the name policy", async () => {
    mockReadContract.mockResolvedValueOnce(true).mockResolvedValueOnce(TERMS)
    expect(await getListing('alice.testing')).toBe(TERMS)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: NAME_POLICY,
        functionName: 'bonaFideNames',
        args: [labelhash('alice')],
      }),
    )
  })

  it('returns nothing for an unlisted name and reads nothing for a subname', async () => {
    mockReadContract.mockResolvedValueOnce(false).mockResolvedValueOnce(TERMS)
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
