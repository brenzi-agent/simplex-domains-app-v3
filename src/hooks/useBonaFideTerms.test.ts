import { mockFunction, renderHook, waitFor } from '@app/test-utils'

import { useQuery } from '@tanstack/react-query'
import { labelhash } from 'viem'
import { readContract } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChainId, useReadContracts } from 'wagmi'

import { ConfigWithEns } from '@app/types'
import { fetchBonaFideTerms } from '@app/utils/snrcBonaFide'

import { getAcceptedClaimTermsQueryFn, useBonaFideTerms } from './useBonaFideTerms'

vi.mock('wagmi')
vi.mock('viem/actions')
vi.mock('@app/utils/snrcBonaFide', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchBonaFideTerms: vi.fn(),
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

const mockUseChainId = mockFunction(useChainId)
const mockUseReadContracts = mockFunction(useReadContracts)
const mockFetchBonaFideTerms = vi.mocked(fetchBonaFideTerms)

const chain = (data?: readonly [boolean, `0x${string}`]) =>
  mockUseReadContracts.mockReturnValue({ data, isFetching: !data } as never)

describe('useBonaFideTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseChainId.mockReturnValue(1337)
  })

  it('reads the listing and the current terms of a 2LD from the name policy', () => {
    chain([false, TERMS])
    const { result } = renderHook(() => useBonaFideTerms({ name: 'alice.simplex' }))
    expect(mockUseReadContracts).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: [
          expect.objectContaining({
            address: NAME_POLICY,
            functionName: 'bonaFideNames',
            args: [labelhash('alice')],
          }),
          expect.objectContaining({ address: NAME_POLICY, functionName: 'termsHash' }),
        ],
        query: expect.objectContaining({ enabled: true }),
      }),
    )
    expect(result.current).toMatchObject({ isListed: false, isLoading: false })
    expect(mockFetchBonaFideTerms).not.toHaveBeenCalled()
  })

  it('does not read for a subname', () => {
    chain()
    const { result } = renderHook(() => useBonaFideTerms({ name: 'mobile.alice.simplex' }))
    expect(mockUseReadContracts).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    )
    expect(result.current.refetch).toBeUndefined()
  })

  it('shows the bundled terms of a listed name only when they hash to the terms on chain', async () => {
    chain([true, TERMS])
    mockFetchBonaFideTerms.mockResolvedValue({ text: 'the terms', hash: TERMS })
    const { result } = renderHook(() => useBonaFideTerms({ name: 'alice.simplex' }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockFetchBonaFideTerms).toHaveBeenCalledWith('/bona-fide-terms.simplex.md')
    expect(result.current).toMatchObject({ isListed: true, text: 'the terms', matches: true })
  })

  it('waits for a fresh listing read and for the terms text', async () => {
    chain(undefined)
    const { result, rerender } = renderHook(() => useBonaFideTerms({ name: 'carol.simplex' }))
    expect(result.current.isLoading).toBe(true)
    let serve: (terms: { text: string; hash: `0x${string}` }) => void = () => {}
    mockFetchBonaFideTerms.mockReturnValue(new Promise((resolve) => (serve = resolve)))
    chain([true, TERMS])
    rerender()
    expect(result.current.isLoading).toBe(true)
    serve({ text: 'the terms', hash: TERMS })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('reports a mismatch when the bundled terms differ from the terms on chain', async () => {
    chain([true, TERMS])
    mockFetchBonaFideTerms.mockResolvedValue({ text: 'old terms', hash: `0x${'88'.repeat(32)}` })
    const { result } = renderHook(() => useBonaFideTerms({ name: 'bob.simplex' }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.matches).toBe(false)
  })
})

describe('useBonaFideTerms on a second mount', () => {
  it('finishes loading when the listing is still fresh in the cache', async () => {
    mockUseChainId.mockReturnValue(1337)
    mockUseReadContracts.mockImplementation(((params: { query: object }) =>
      useQuery({
        queryKey: ['readContracts', 'freshness'],
        queryFn: async () => [true, TERMS],
        ...params.query,
      })) as never)
    mockFetchBonaFideTerms.mockResolvedValue({ text: 'the terms', hash: TERMS })
    const first = renderHook(() => useBonaFideTerms({ name: 'alice.simplex' }))
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    first.unmount()

    const second = renderHook(() => useBonaFideTerms({ name: 'alice.simplex' }))
    await waitFor(() => expect(second.result.current.isLoading).toBe(false))
  })
})

describe('getAcceptedClaimTermsQueryFn', () => {
  const mockReadContract = vi.mocked(readContract)
  const config = { getClient: () => ({}) } as unknown as ConfigWithEns
  const getAcceptedClaimTerms = (holder?: `0x${string}`, recipient?: `0x${string}`) =>
    getAcceptedClaimTermsQueryFn(config)({
      queryKey: [
        { name: 'alice.testing', holder },
        1337,
        recipient,
        undefined,
        'getAcceptedClaimTerms',
      ],
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
