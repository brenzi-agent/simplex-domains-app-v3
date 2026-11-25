import { Address, Hex, parseAbi } from 'viem'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import type { SignedIntent } from './snrcIntents'

export type PartnerIntents = { commitment: Hex; terms?: SignedIntent; register: SignedIntent }

export type Partner = { owner: Address; intents?: PartnerIntents }

export type Credit = { disputeDays: number; partner?: Partner }

export const sponsorAbi = parseAbi([
  'struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }',
  'function registrarAllowance(address registrar) view returns (uint256)',
  'function registerWithCredit(Registration registration, uint256 disputeDays, uint256 nonce, uint256 deadline, bytes sig)',
])

export const makeRegisterWithCreditArgs = (
  registrationParams: RegistrationParameters,
  { disputeDays, partner }: Credit,
) => {
  const intent = partner?.intents?.register
  return [
    makeRegistrationCallData(registrationParams),
    BigInt(disputeDays),
    intent?.nonce ?? 0n,
    intent?.deadline ?? 0n,
    intent?.signature ?? '0x',
  ] as const
}

export const isSignedFor = ({ intents }: Partner, commitment: Hex) =>
  !!intents &&
  intents.commitment === commitment &&
  intents.register.deadline > BigInt(Math.floor(Date.now() / 1000))
