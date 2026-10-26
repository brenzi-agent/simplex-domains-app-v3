import {
  Address,
  decodeFunctionData,
  encodeFunctionData,
  getAbiItem,
  getAddress,
  Hex,
  toFunctionSelector,
} from 'viem'

import { ethRegistrarControllerCommitSnippet } from '@ensdomains/ensjs/contracts'

import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

const policyCommitSelector = toFunctionSelector(
  getAbiItem({ abi: namePolicyBonaFideAbi, name: 'commitUnderBonaFideCommunityTerms' }),
)

export const isCommitCallFor = ({
  commitment,
  controller,
  namePolicy,
}: {
  commitment: Hex
  controller: Address
  namePolicy?: Address
}) => {
  const controllerCommit = encodeFunctionData({
    abi: ethRegistrarControllerCommitSnippet,
    args: [commitment],
    functionName: 'commit',
  })
  return (to: Address, input: Hex) => {
    if (getAddress(to) === getAddress(controller)) return input === controllerCommit
    if (!namePolicy || getAddress(to) !== getAddress(namePolicy)) return false
    if (!input.startsWith(policyCommitSelector)) return false
    const { args } = decodeFunctionData({ abi: namePolicyBonaFideAbi, data: input })
    return args[0] === commitment
  }
}
