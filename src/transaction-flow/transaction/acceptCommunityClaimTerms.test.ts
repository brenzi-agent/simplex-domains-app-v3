import { decodeFunctionData, labelhash } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'

import acceptCommunityClaimTerms from './acceptCommunityClaimTerms'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const HOLDER = '0x2222222222222222222222222222222222222222'
const TERMS = `0x${'77'.repeat(32)}` as const

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => NAME_POLICY,
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as unknown as ConnectorClientWithEns

describe('acceptCommunityClaimTerms', () => {
  it('accepts for the reviewed offer of the holder', () => {
    const tx = acceptCommunityClaimTerms.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', holder: HOLDER, offerNumber: 3n, termsHash: TERMS },
    })
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: namePolicyCommunityAbi, data: tx.data })).toEqual({
      functionName: 'acceptCommunityTermsForClaim',
      args: [BigInt(labelhash('alice')), HOLDER, 3n, TERMS],
    })
  })
})
