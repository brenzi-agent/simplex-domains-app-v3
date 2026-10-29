import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'

import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'

import { isPolicyCommit } from './isPolicyCommit'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const OTHER = '0x5555555555555555555555555555555555555555'
const COMMITMENT = `0x${'cc'.repeat(32)}` as const
const TERMS = `0x${'77'.repeat(32)}` as const

const policyCommit = (commitment: `0x${string}`) =>
  encodeFunctionData({
    abi: namePolicyCommunityAbi,
    functionName: 'commitUnderCommunityTerms',
    args: [commitment, TERMS],
  })
const acceptForClaim = encodeFunctionData({
  abi: namePolicyCommunityAbi,
  functionName: 'acceptCommunityTermsForClaim',
  args: [1n, OTHER, 0n, TERMS],
})
const expected = { commitment: COMMITMENT, namePolicyAddress: NAME_POLICY } as const

describe('isPolicyCommit', () => {
  it('matches the commitment sent through the name policy', () => {
    expect(isPolicyCommit({ to: NAME_POLICY, input: policyCommit(COMMITMENT) }, expected)).toBe(
      true,
    )
  })

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
