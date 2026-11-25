import {
  BaseError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  parseAbi,
  parseAbiParameters,
  RawContractError,
} from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { getReadableError } from './errors'
import { getAllowanceCharge, makeRegisterWithCreditCall } from './snrcSponsor'

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
    expect(
      makeRegisterWithCreditCall({ chainId: 1, registrationParams, credit: { owner: REGISTRAR } }),
    ).toEqual(
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

  it.each([
    ['InsufficientAllowance', 'error InsufficientAllowance(uint256 required, uint256 available)', [2n, 1n]],
    ['DisputeDaysOutOfRange', 'error DisputeDaysOutOfRange(uint256 disputeDays)', [200n]],
  ] as const)('names a %s revert', (errorName, signature, args) => {
    const data = encodeErrorResult({ abi: parseAbi([signature]), errorName, args } as never)
    const error = new BaseError('reverted', { cause: new RawContractError({ data }) })
    expect(getReadableError(error)).toEqual({ message: errorName, type: 'contract' })
  })
})
