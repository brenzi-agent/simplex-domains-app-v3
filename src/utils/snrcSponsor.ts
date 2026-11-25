import { Address, Log, parseAbi, parseEventLogs } from 'viem'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { getSponsorAddress } from '@app/constants/chains'
import { MIN_DISPUTE_DAYS } from '@app/constants/simplex'

export type Credit = { owner: Address }

export const sponsorAbi = parseAbi([
  'struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }',
  'function registrarAllowance(address registrar) view returns (uint256)',
  'function registerWithCredit(Registration registration, uint256 disputeDays, uint256 nonce, uint256 deadline, bytes sig)',
  'event RegistrarAllowanceSpent(address indexed registrar, uint256 spentUSD, uint256 remainingUSD)',
])

export const makeRegisterWithCreditCall = ({
  chainId,
  registrationParams,
}: {
  chainId: number
  registrationParams: RegistrationParameters
}) =>
  ({
    address: getSponsorAddress(chainId),
    abi: sponsorAbi,
    functionName: 'registerWithCredit',
    args: [makeRegistrationCallData(registrationParams), BigInt(MIN_DISPUTE_DAYS), 0n, 0n, '0x'],
  }) as const

export const getAllowanceCharge = (logs: Log[]) =>
  parseEventLogs({ abi: sponsorAbi, eventName: 'RegistrarAllowanceSpent', logs })[0]?.args
    .spentUSD
