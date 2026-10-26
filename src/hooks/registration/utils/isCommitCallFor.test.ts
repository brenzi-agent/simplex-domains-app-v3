import { encodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'

import { ethRegistrarControllerCommitSnippet } from '@ensdomains/ensjs/contracts'

import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

import { isCommitCallFor } from './isCommitCallFor'

const CONTROLLER = '0x1111111111111111111111111111111111111111'
const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const OTHER = '0x5555555555555555555555555555555555555555'
const COMMITMENT = `0x${'cc'.repeat(32)}` as const
const TERMS = `0x${'77'.repeat(32)}` as const

const controllerCommit = (commitment: `0x${string}`) =>
  encodeFunctionData({
    abi: ethRegistrarControllerCommitSnippet,
    functionName: 'commit',
    args: [commitment],
  })
const policyCommit = (commitment: `0x${string}`) =>
  encodeFunctionData({
    abi: namePolicyBonaFideAbi,
    functionName: 'commitUnderBonaFideCommunityTerms',
    args: [commitment, TERMS],
  })

describe('isCommitCallFor', () => {
  const isCommitCall = isCommitCallFor({
    commitment: COMMITMENT,
    controller: CONTROLLER,
    namePolicy: NAME_POLICY,
  })

  it('matches the commitment sent to the controller or through the name policy', () => {
    expect(isCommitCall(CONTROLLER, controllerCommit(COMMITMENT))).toBe(true)
    expect(isCommitCall(NAME_POLICY, policyCommit(COMMITMENT))).toBe(true)
  })

  it('refuses another commitment, another contract or another call', () => {
    const other = `0x${'dd'.repeat(32)}` as const
    expect(isCommitCall(CONTROLLER, controllerCommit(other))).toBe(false)
    expect(isCommitCall(NAME_POLICY, policyCommit(other))).toBe(false)
    expect(isCommitCall(OTHER, policyCommit(COMMITMENT))).toBe(false)
    expect(isCommitCall(NAME_POLICY, controllerCommit(COMMITMENT))).toBe(false)
    expect(
      isCommitCallFor({ commitment: COMMITMENT, controller: CONTROLLER })(
        NAME_POLICY,
        policyCommit(COMMITMENT),
      ),
    ).toBe(false)
  })
})
