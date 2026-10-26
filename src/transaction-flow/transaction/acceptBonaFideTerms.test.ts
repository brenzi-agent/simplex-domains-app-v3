import { decodeFunctionData, labelhash } from 'viem'
import { readContract } from 'viem/actions'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

import acceptBonaFideTerms from './acceptBonaFideTerms'

const REGISTRAR = '0x1111111111111111111111111111111111111111'
const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const HOLDER = '0x2222222222222222222222222222222222222222'
const TERMS = `0x${'77'.repeat(32)}` as const
const COMMITMENT = `0x${'cc'.repeat(32)}` as const

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({
    BaseRegistrarImplementation: REGISTRAR,
    SimplexNamePolicy: NAME_POLICY,
  }),
}))
vi.mock('viem/actions')

const mockReadContract = vi.mocked(readContract)

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as unknown as ConnectorClientWithEns

describe('acceptBonaFideTerms', () => {
  it('accepts for a commitment through the name policy', async () => {
    const tx = await acceptBonaFideTerms.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', termsHash: TERMS, commitment: COMMITMENT },
    })
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: namePolicyBonaFideAbi, data: tx.data })).toEqual({
      functionName: 'commitUnderBonaFideCommunityTerms',
      args: [COMMITMENT, TERMS],
    })
  })

  it('accepts for the current offer of the holder', async () => {
    mockReadContract.mockResolvedValueOnce(3n)
    const tx = await acceptBonaFideTerms.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', termsHash: TERMS, holder: HOLDER },
    })
    const tokenId = BigInt(labelhash('alice'))
    expect(mockReadContract).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ address: REGISTRAR, functionName: 'offers', args: [tokenId] }),
    )
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: namePolicyBonaFideAbi, data: tx.data })).toEqual({
      functionName: 'acceptBonaFideCommunityTermsForClaim',
      args: [tokenId, HOLDER, 3n, TERMS],
    })
  })

  it('displays the name and the action', () => {
    expect(
      acceptBonaFideTerms.displayItems(
        { name: 'alice.testing', termsHash: TERMS, holder: HOLDER },
        ((key: string) => key) as never,
      ),
    ).toEqual([
      { label: 'name', value: 'alice.testing', type: 'name' },
      { label: 'action', value: 'transaction.description.acceptBonaFideTerms' },
    ])
  })
})
