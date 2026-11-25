import { Address, encodeFunctionData, labelhash, parseAbi } from 'viem'

import { ALLOWED_LABEL_REGEX } from '@app/hooks/useValidate'

import { NO_ANNOUNCEMENT, SignedIntent } from './snrcIntents'
import { isEthLikeTld } from './utils'

export const registrarOfferAbi = parseAbi([
  'function baseNode() view returns (bytes32)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function offers(uint256 tokenId) view returns (uint256)',
  'function approve(address to, uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function approveWithSig(address from, address to, uint256 tokenId, uint256 nonce, uint256 deadline, bytes sig, bytes ephemeralPubKey, bytes1 viewTag)',
])

export const getSnrcTokenId = (name: string) => {
  const labels = name.split('.')
  if (labels.length !== 2 || !isEthLikeTld(name) || !ALLOWED_LABEL_REGEX.test(labels[0]))
    return undefined
  return BigInt(labelhash(labels[0]))
}

export const encodeApproveName = ({
  name,
  to,
  intent,
}: {
  name: string
  to: Address
  intent?: SignedIntent
}) => {
  const tokenId = getSnrcTokenId(name)!
  return intent
    ? encodeFunctionData({
        abi: registrarOfferAbi,
        functionName: 'approveWithSig',
        args: [
          intent.signer,
          to,
          tokenId,
          intent.nonce,
          intent.deadline,
          intent.signature,
          NO_ANNOUNCEMENT.ephemeralPubKey,
          NO_ANNOUNCEMENT.viewTag,
        ],
      })
    : encodeFunctionData({ abi: registrarOfferAbi, functionName: 'approve', args: [to, tokenId] })
}
