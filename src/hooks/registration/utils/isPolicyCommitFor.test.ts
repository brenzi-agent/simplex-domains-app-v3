import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'

import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

import { isPolicyCommitFor } from './isPolicyCommitFor'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const OTHER = '0x5555555555555555555555555555555555555555'
const COMMITMENT = `0x${'cc'.repeat(32)}` as const
const TERMS = `0x${'77'.repeat(32)}` as const

const policyCommit = (commitment: `0x${string}`) =>
  encodeFunctionData({
    abi: namePolicyBonaFideAbi,
    functionName: 'commitUnderBonaFideCommunityTerms',
    args: [commitment, TERMS],
  })
const acceptForClaim = encodeFunctionData({
  abi: namePolicyBonaFideAbi,
  functionName: 'acceptBonaFideCommunityTermsForClaim',
  args: [1n, OTHER, 0n, TERMS],
})

describe('isPolicyCommitFor', () => {
  const isPolicyCommit = isPolicyCommitFor({ commitment: COMMITMENT, namePolicy: NAME_POLICY })

  it('matches the commitment sent through the name policy', () => {
    expect(isPolicyCommit(NAME_POLICY, policyCommit(COMMITMENT))).toBe(true)
  })

  it('refuses another commitment, another contract, another call or no name policy', () => {
    expect(isPolicyCommit(NAME_POLICY, policyCommit(`0x${'dd'.repeat(32)}`))).toBe(false)
    expect(isPolicyCommit(OTHER, policyCommit(COMMITMENT))).toBe(false)
    expect(isPolicyCommit(NAME_POLICY, acceptForClaim)).toBe(false)
    expect(isPolicyCommitFor({ commitment: COMMITMENT })(NAME_POLICY, policyCommit(COMMITMENT))).toBe(
      false,
    )
  })
})
