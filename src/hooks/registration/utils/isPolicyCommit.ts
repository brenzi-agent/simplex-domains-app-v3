import { Address, decodeFunctionData, getAbiItem, getAddress, Hex, toFunctionSelector } from 'viem'

import { namePolicyTermsAbi } from '@app/utils/snrcNameTerms'

const policyCommitSelectors = (
  [
    'commitUnderGeneralTerms',
    'commitUnderCommunityTerms',
    'commitUnderGeneralTermsWithSig',
    'commitUnderCommunityTermsWithSig',
  ] as const
).map((name) => toFunctionSelector(getAbiItem({ abi: namePolicyTermsAbi, name })))

const decodePolicyCommit = (
  { to, input }: { to: Address | null; input: Hex },
  namePolicyAddress?: Address,
) => {
  if (!to || !namePolicyAddress || getAddress(to) !== getAddress(namePolicyAddress))
    return undefined
  if (!policyCommitSelectors.some((selector) => input.startsWith(selector))) return undefined
  return decodeFunctionData({ abi: namePolicyTermsAbi, data: input })
}

export const isPolicyCommit = (
  transaction: { to: Address | null; input: Hex },
  { commitment, namePolicyAddress }: { commitment: Hex; namePolicyAddress?: Address },
) => decodePolicyCommit(transaction, namePolicyAddress)?.args[0] === commitment

export const isRelayedPolicyCommit = (
  transaction: { to: Address | null; input: Hex },
  {
    commitment,
    namePolicyAddress,
    acceptor,
  }: { commitment: Hex; namePolicyAddress?: Address; acceptor: Address },
) => {
  const call = decodePolicyCommit(transaction, namePolicyAddress)
  return (
    (call?.functionName === 'commitUnderGeneralTermsWithSig' ||
      call?.functionName === 'commitUnderCommunityTermsWithSig') &&
    call.args[0] === commitment &&
    getAddress(call.args[2]) === getAddress(acceptor)
  )
}
