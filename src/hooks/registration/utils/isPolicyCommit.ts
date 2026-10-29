import { Address, decodeFunctionData, getAbiItem, getAddress, Hex, toFunctionSelector } from 'viem'

import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'

const policyCommitSelector = toFunctionSelector(
  getAbiItem({ abi: namePolicyCommunityAbi, name: 'commitUnderCommunityTerms' }),
)

export const isPolicyCommit = (
  { to, input }: { to: Address | null; input: Hex },
  { commitment, namePolicyAddress }: { commitment: Hex; namePolicyAddress?: Address },
) => {
  if (!to || !namePolicyAddress || getAddress(to) !== getAddress(namePolicyAddress)) return false
  if (!input.startsWith(policyCommitSelector)) return false
  const { args } = decodeFunctionData({ abi: namePolicyCommunityAbi, data: input })
  return args[0] === commitment
}
