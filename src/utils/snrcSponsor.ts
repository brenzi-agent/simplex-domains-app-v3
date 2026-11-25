import { parseAbi } from 'viem'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

export type Credit = { disputeDays: number }

export const sponsorAbi = parseAbi([
  'struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }',
  'function registrarAllowance(address registrar) view returns (uint256)',
  'function registerWithCredit(Registration registration, uint256 disputeDays, uint256 nonce, uint256 deadline, bytes sig)',
])

export const makeRegisterWithCreditArgs = (
  registrationParams: RegistrationParameters,
  { disputeDays }: Credit,
) =>
  [makeRegistrationCallData(registrationParams), BigInt(disputeDays), 0n, 0n, '0x'] as const
