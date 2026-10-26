import { Address, decodeFunctionData, getAbiItem, getAddress, Hex, toFunctionSelector } from 'viem'

import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

const policyCommitSelector = toFunctionSelector(
  getAbiItem({ abi: namePolicyBonaFideAbi, name: 'commitUnderBonaFideCommunityTerms' }),
)

export const isPolicyCommit = (
  { to, input }: { to: Address | null; input: Hex },
  { commitment, namePolicy }: { commitment: Hex; namePolicy?: Address },
) => {
  if (!to || !namePolicy || getAddress(to) !== getAddress(namePolicy)) return false
  if (!input.startsWith(policyCommitSelector)) return false
  const { args } = decodeFunctionData({ abi: namePolicyBonaFideAbi, data: input })
  return args[0] === commitment
}
