import {
  BaseError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  parseAbi,
  parseAbiParameters,
  RawContractError,
} from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { getReadableError } from './errors'
import { getAllowanceCharge, isSignedFor, makeRegisterWithCreditCall } from './snrcSponsor'

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSponsorAddress: () => SPONSOR,
}))

const SPONSOR = '0x5555555555555555555555555555555555555555'
const REGISTRAR = '0x2222222222222222222222222222222222222222'

const registrationParams: RegistrationParameters = {
  name: 'alicebob.simplex',
  owner: REGISTRAR,
  duration: 63072000,
  secret: `0x${'33'.repeat(32)}` as const,
}

describe('the sponsored registration', () => {
  it('is one call to the sponsor with the minimum dispute days, unsigned for the registrar', () => {
    expect(makeRegisterWithCreditCall({ chainId: 1, registrationParams })).toEqual(
      expect.objectContaining({
        address: SPONSOR,
        functionName: 'registerWithCredit',
        args: [makeRegistrationCallData(registrationParams), 14n, 0n, 0n, '0x'],
      }),
    )
  })

  it("is charged the spentUSD of the sponsor's RegistrarAllowanceSpent log", () => {
    const event = parseAbi([
      'event RegistrarAllowanceSpent(address indexed registrar, uint256 spentUSD, uint256 remainingUSD)',
    ])
    const spent = {
      address: SPONSOR,
      topics: encodeEventTopics({
        abi: event,
        eventName: 'RegistrarAllowanceSpent',
        args: { registrar: REGISTRAR },
      }),
      data: encodeAbiParameters(parseAbiParameters('uint256, uint256'), [
        100n * 10n ** 18n,
        900n * 10n ** 18n,
      ]),
    }
    const unrelated = { address: SPONSOR, topics: [`0x${'99'.repeat(32)}`], data: '0x' }
    expect(getAllowanceCharge([unrelated, spent] as never)).toBe(100n * 10n ** 18n)
    expect(getAllowanceCharge([unrelated] as never)).toBeUndefined()
  })

  it('is one call to the sponsor with the registration the temporary owner signed', () => {
    const intent = {
      nonce: 2n,
      deadline: 1_900_000_000n,
      signature: `0x${'ab'.repeat(65)}`,
    } as const
    const { args } = makeRegisterWithCreditCall({ chainId: 1, registrationParams, intent })
    expect(args.slice(1)).toEqual([14n, 2n, 1_900_000_000n, intent.signature])
  })

  it.each([
    [
      'InsufficientAllowance',
      'error InsufficientAllowance(uint256 required, uint256 available)',
      [2n, 1n],
    ],
    ['DisputeDaysOutOfRange', 'error DisputeDaysOutOfRange(uint256 disputeDays)', [200n]],
    ['DisputePeriodOver', 'error DisputePeriodOver(uint256 id)', [1n]],
    [
      'DisputeUntilMismatch',
      'error DisputeUntilMismatch(uint256 named, uint256 current)',
      [1n, 2n],
    ],
  ] as const)('names a %s revert', (errorName, signature, args) => {
    const data = encodeErrorResult({ abi: parseAbi([signature]), errorName, args } as never)
    const error = new BaseError('reverted', { cause: new RawContractError({ data }) })
    expect(getReadableError(error)).toEqual({ message: errorName, type: 'contract' })
  })
})

describe('the signatures of a temporary owner', () => {
  const NOW = 1_800_000_000
  const COMMITMENT = `0x${'cc'.repeat(32)}` as const
  const TERMS = { kind: 'general', hash: `0x${'77'.repeat(32)}` } as const
  const intent = (deadline: number) =>
    ({ nonce: 0n, deadline: BigInt(deadline), signature: `0x${'ab'.repeat(65)}` }) as const
  const signed = (deadline: number) => ({
    owner: REGISTRAR,
    intents: {
      commitment: COMMITMENT,
      terms: { ...TERMS, intent: intent(deadline) },
      register: intent(deadline),
    },
  })

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW * 1000 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const TWO_DAYS = NOW + 2 * 86400

  it('hold for a commit when they cover its commitment and terms beyond its 24 hours', () => {
    expect(isSignedFor(signed(TWO_DAYS), { commitment: COMMITMENT, terms: TERMS })).toBe(true)
  })

  it.each([
    ['are missing', { owner: REGISTRAR }, COMMITMENT, TERMS],
    ['are for another commitment', signed(TWO_DAYS), `0x${'dd'.repeat(32)}`, TERMS],
    ['accept other terms', signed(TWO_DAYS), COMMITMENT, { kind: 'community', hash: TERMS.hash }],
    ['end within the 24 hours of a commit', signed(NOW + 86400), COMMITMENT, TERMS],
  ] as const)('do not hold for a commit when they %s', (_, credit, commitment, terms) => {
    expect(isSignedFor(credit, { commitment, terms })).toBe(false)
  })
})
