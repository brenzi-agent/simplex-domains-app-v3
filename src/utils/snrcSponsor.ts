import { Address, Hex, Log, parseAbi, parseEventLogs } from 'viem'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { getSponsorAddress } from '@app/constants/chains'
import { MIN_DISPUTE_DAYS } from '@app/constants/simplex'

import type { Intent } from './snrcIntents'
import type { Terms } from './snrcNameTerms'

type OwnerIntents = { commitment: Hex; terms?: Terms & { intent: Intent }; register: Intent }

export type Credit = { owner: Address; intents?: OwnerIntents }

export type SignedCredit = Required<Credit>

export type SigningState = { policyNonce: bigint; sponsorNonce: bigint; maxCommitmentAge: bigint }

const COMMIT_MARGIN = 3600n

export const sponsorAbi = parseAbi([
  'struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }',
  'function registrarAllowance(address registrar) view returns (uint256)',
  'function registerWithCredit(Registration registration, uint256 disputeDays, uint256 nonce, uint256 deadline, bytes sig)',
  'event RegistrarAllowanceSpent(address indexed registrar, uint256 spentUSD, uint256 remainingUSD)',
])

export const makeRegisterWithCreditCall = ({
  chainId,
  registrationParams,
  intent,
}: {
  chainId: number
  registrationParams: RegistrationParameters
  intent?: Intent
}) =>
  ({
    address: getSponsorAddress(chainId),
    abi: sponsorAbi,
    functionName: 'registerWithCredit',
    args: [
      makeRegistrationCallData(registrationParams),
      BigInt(MIN_DISPUTE_DAYS),
      intent?.nonce ?? 0n,
      intent?.deadline ?? 0n,
      intent?.signature ?? '0x',
    ],
  }) as const

export const getAllowanceCharge = (logs: Log[]) =>
  parseEventLogs({ abi: sponsorAbi, eventName: 'RegistrarAllowanceSpent', logs })[0]?.args
    .spentUSD

export const isSignedFor = (
  credit: Credit,
  { commitment, terms, onChain }: { commitment: Hex; terms?: Terms; onChain: SigningState },
): credit is SignedCredit =>
  !!credit.intents &&
  credit.intents.commitment === commitment &&
  credit.intents.terms?.kind === terms?.kind &&
  credit.intents.terms?.hash === terms?.hash &&
  (!credit.intents.terms || credit.intents.terms.intent.nonce === onChain.policyNonce) &&
  credit.intents.register.nonce === onChain.sponsorNonce &&
  credit.intents.register.deadline >
    BigInt(Math.floor(Date.now() / 1000)) + onChain.maxCommitmentAge + COMMIT_MARGIN
