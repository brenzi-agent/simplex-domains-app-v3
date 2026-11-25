import { encodeFunctionData, parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'

import { namePolicyTermsAbi } from '@app/utils/snrcNameTerms'

import { isPolicyCommit, isRelayedPolicyCommit } from './isPolicyCommit'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const OTHER = '0x5555555555555555555555555555555555555555'
const COMMITMENT = `0x${'cc'.repeat(32)}` as const
const TERMS = `0x${'77'.repeat(32)}` as const

const policyCommit = (
  commitment: `0x${string}`,
  functionName: 'commitUnderGeneralTerms' | 'commitUnderCommunityTerms' = 'commitUnderGeneralTerms',
) =>
  encodeFunctionData({
    abi: namePolicyTermsAbi,
    functionName,
    args: [commitment, TERMS],
  })
const acceptForClaim = encodeFunctionData({
  abi: namePolicyTermsAbi,
  functionName: 'acceptGeneralTermsForClaim',
  args: [1n, OTHER, 0n, TERMS],
})
const expected = { commitment: COMMITMENT, namePolicyAddress: NAME_POLICY } as const

describe('isPolicyCommit', () => {
  it.each(['commitUnderGeneralTerms', 'commitUnderCommunityTerms'] as const)(
    'matches the commitment sent through the name policy by %s',
    (functionName) => {
      expect(
        isPolicyCommit(
          { to: NAME_POLICY, input: policyCommit(COMMITMENT, functionName) },
          expected,
        ),
      ).toBe(true)
    },
  )

  it.each(['commitUnderGeneralTermsWithSig', 'commitUnderCommunityTermsWithSig'] as const)(
    'matches the commitment relayed for its owner through the name policy by %s',
    (functionName) => {
      const input = encodeFunctionData({
        abi: parseAbi([
          'function commitUnderGeneralTermsWithSig(bytes32 commitment, bytes32 acceptedTermsHash, address acceptor, uint256 nonce, uint256 deadline, bytes sig)',
          'function commitUnderCommunityTermsWithSig(bytes32 commitment, bytes32 acceptedTermsHash, address acceptor, uint256 nonce, uint256 deadline, bytes sig)',
        ]),
        functionName,
        args: [COMMITMENT, TERMS, OTHER, 0n, 1_900_000_000n, '0x'],
      })
      expect(isPolicyCommit({ to: NAME_POLICY, input }, expected)).toBe(true)
    },
  )

  it('returns false for another commitment, contract or call, a contract creation and no name policy', () => {
    const other = `0x${'dd'.repeat(32)}` as const
    expect(isPolicyCommit({ to: NAME_POLICY, input: policyCommit(other) }, expected)).toBe(false)
    expect(isPolicyCommit({ to: OTHER, input: policyCommit(COMMITMENT) }, expected)).toBe(false)
    expect(isPolicyCommit({ to: NAME_POLICY, input: acceptForClaim }, expected)).toBe(false)
    expect(isPolicyCommit({ to: null, input: policyCommit(COMMITMENT) }, expected)).toBe(false)
    expect(
      isPolicyCommit(
        { to: NAME_POLICY, input: policyCommit(COMMITMENT) },
        { commitment: COMMITMENT },
      ),
    ).toBe(false)
  })
})

describe('isRelayedPolicyCommit', () => {
  const relayedFor = (acceptor: `0x${string}`) =>
    encodeFunctionData({
      abi: parseAbi([
        'function commitUnderCommunityTermsWithSig(bytes32 commitment, bytes32 acceptedTermsHash, address acceptor, uint256 nonce, uint256 deadline, bytes sig)',
      ]),
      functionName: 'commitUnderCommunityTermsWithSig',
      args: [COMMITMENT, TERMS, acceptor, 0n, 1_900_000_000n, '0x'],
    })
  const forOther = { ...expected, acceptor: OTHER } as const

  it('matches a commitment relayed for its acceptor, whoever sent it', () => {
    expect(isRelayedPolicyCommit({ to: NAME_POLICY, input: relayedFor(OTHER) }, forOther)).toBe(
      true,
    )
  })

  it('returns false for another acceptor and for a commit by the acceptor itself', () => {
    expect(
      isRelayedPolicyCommit({ to: NAME_POLICY, input: relayedFor(NAME_POLICY) }, forOther),
    ).toBe(false)
    expect(
      isRelayedPolicyCommit({ to: NAME_POLICY, input: policyCommit(COMMITMENT) }, forOther),
    ).toBe(false)
  })
})
