import { Address, BaseError, Hex, parseAbi, TypedDataDefinition } from 'viem'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import type { Terms } from './snrcNameTerms'
import { ONE_DAY } from './time'

export type SignedIntent = { signer: Address; nonce: bigint; deadline: bigint; signature: Hex }

export const noncesAbi = parseAbi(['function nonces(address signer) view returns (uint256)'])

export const NO_ANNOUNCEMENT = { ephemeralPubKey: '0x', viewTag: '0x00' } as const

export const intentDeadline = () => BigInt(Math.floor(Date.now() / 1000) + ONE_DAY)

export const signingErrorMessage = (error: Error) =>
  error instanceof BaseError ? error.shortMessage : error.message

const acceptTermsPrimaryType = {
  general: 'AcceptGeneralTerms',
  community: 'AcceptCommunityTerms',
} as const

export const makeAcceptTermsTypedData = ({
  chainId,
  namePolicy,
  commitment,
  terms,
  nonce,
  deadline,
}: {
  chainId: number
  namePolicy: Address
  commitment: Hex
  terms: Terms
  nonce: bigint
  deadline: bigint
}): TypedDataDefinition => ({
  domain: { name: 'SimplexNamePolicy', version: '1', chainId, verifyingContract: namePolicy },
  types: {
    [acceptTermsPrimaryType[terms.kind]]: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'termsHash', type: 'bytes32' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: acceptTermsPrimaryType[terms.kind],
  message: { commitment, termsHash: terms.hash, nonce, deadline },
})

export const makeRegisterNameTypedData = ({
  chainId,
  sponsor,
  registrationParams,
  disputeDays,
  nonce,
  deadline,
}: {
  chainId: number
  sponsor: Address
  registrationParams: RegistrationParameters
  disputeDays: number
  nonce: bigint
  deadline: bigint
}) => {
  const { label, owner, duration, resolver, data } = makeRegistrationCallData(registrationParams)
  return {
    domain: { name: 'SimplexSponsor', version: '1', chainId, verifyingContract: sponsor },
    types: {
      RegisterName: [
        { name: 'label', type: 'string' },
        { name: 'owner', type: 'address' },
        { name: 'duration', type: 'uint256' },
        { name: 'resolver', type: 'address' },
        { name: 'data', type: 'bytes[]' },
        { name: 'disputeDays', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'RegisterName',
    message: {
      label,
      owner,
      duration,
      resolver,
      data,
      disputeDays: BigInt(disputeDays),
      nonce,
      deadline,
    },
  } as const
}

export const makeApproveNameTypedData = ({
  chainId,
  registrar,
  from,
  to,
  tokenId,
  nonce,
  deadline,
}: {
  chainId: number
  registrar: Address
  from: Address
  to: Address
  tokenId: bigint
  nonce: bigint
  deadline: bigint
}) =>
  ({
    domain: { name: 'SimplexNames', version: '1', chainId, verifyingContract: registrar },
    types: {
      ApproveName: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'ephemeralPubKey', type: 'bytes' },
        { name: 'viewTag', type: 'bytes1' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'ApproveName',
    message: { from, to, tokenId, ...NO_ANNOUNCEMENT, nonce, deadline },
  }) as const
