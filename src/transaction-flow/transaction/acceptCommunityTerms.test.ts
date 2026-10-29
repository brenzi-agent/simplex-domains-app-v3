import { decodeFunctionData } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'

import acceptCommunityTerms from './acceptCommunityTerms'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const TERMS = `0x${'77'.repeat(32)}` as const
const COMMITMENT = `0x${'cc'.repeat(32)}` as const

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => NAME_POLICY,
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as unknown as ConnectorClientWithEns

describe('acceptCommunityTerms', () => {
  it('accepts for a commitment through the name policy', () => {
    const tx = acceptCommunityTerms.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', commitment: COMMITMENT, termsHash: TERMS },
    })
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: namePolicyCommunityAbi, data: tx.data })).toEqual({
      functionName: 'commitUnderCommunityTerms',
      args: [COMMITMENT, TERMS],
    })
  })
})
