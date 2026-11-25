import { decodeFunctionData, parseAbi } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { namePolicyTermsAbi } from '@app/utils/snrcNameTerms'

import acceptTerms from './acceptTerms'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const TERMS = `0x${'77'.repeat(32)}` as const
const COMMITMENT = `0x${'cc'.repeat(32)}` as const

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => NAME_POLICY,
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as unknown as ConnectorClientWithEns

describe('acceptTerms', () => {
  it.each([
    ['general', 'commitUnderGeneralTerms'],
    ['community', 'commitUnderCommunityTerms'],
  ] as const)('accepts the %s terms for a commitment through the name policy', (kind, call) => {
    const tx = acceptTerms.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', commitment: COMMITMENT, terms: { kind, hash: TERMS } },
    })
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: namePolicyTermsAbi, data: tx.data })).toEqual({
      functionName: call,
      args: [COMMITMENT, TERMS],
    })
  })

  const withSigAbi = parseAbi([
    'function commitUnderGeneralTermsWithSig(bytes32 commitment, bytes32 acceptedTermsHash, address acceptor, uint256 nonce, uint256 deadline, bytes sig)',
    'function commitUnderCommunityTermsWithSig(bytes32 commitment, bytes32 acceptedTermsHash, address acceptor, uint256 nonce, uint256 deadline, bytes sig)',
  ])
  const intent = {
    signer: '0x2222222222222222222222222222222222222222',
    nonce: 3n,
    deadline: 1_900_000_000n,
    signature: `0x${'ab'.repeat(65)}`,
  } as const

  it.each([
    ['general', 'commitUnderGeneralTermsWithSig'],
    ['community', 'commitUnderCommunityTermsWithSig'],
  ] as const)('relays the %s terms the owner accepted for a commitment by signing', (kind, call) => {
    const tx = acceptTerms.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', commitment: COMMITMENT, terms: { kind, hash: TERMS }, intent },
    })
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: withSigAbi, data: tx.data })).toEqual({
      functionName: call,
      args: [COMMITMENT, TERMS, intent.signer, intent.nonce, intent.deadline, intent.signature],
    })
  })

  it('shows the owner in the confirmation of an acceptance relayed for it', () => {
    const t = ((key: string) => key) as never
    const data = {
      name: 'alice.testing',
      commitment: COMMITMENT,
      terms: { kind: 'general', hash: TERMS },
    } as const
    const owner = { label: 'owner', value: intent.signer, type: 'address' }
    expect(acceptTerms.displayItems(data, t)).not.toContainEqual(owner)
    expect(acceptTerms.displayItems({ ...data, intent }, t)).toContainEqual(owner)
  })
})
