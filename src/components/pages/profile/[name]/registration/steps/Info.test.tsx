import { mockFunction, render, screen, userEvent, waitFor } from '@app/test-utils'

import { BaseError, zeroHash } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublicClient, useReadContract, useSignTypedData } from 'wagmi'

import { makeCommitment } from '@ensdomains/ensjs/utils'

import { useAccountSafely } from '@app/hooks/account/useAccountSafely'
import { useEstimateFullRegistration } from '@app/hooks/gasEstimation/useEstimateRegistration'
import { yearsToSeconds } from '@app/utils/utils'

import { RegistrationReducerDataItem } from '../types'
import Info from './Info'

vi.mock('wagmi')
vi.mock('@app/hooks/account/useAccountSafely')
vi.mock('@app/hooks/gasEstimation/useEstimateRegistration')
vi.mock('../FullInvoice', () => ({ default: () => <div data-testid="full-invoice" /> }))
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ ETHRegistrarController: CONTROLLER }),
  getSponsorAddress: () => SPONSOR,
  getNamePolicyAddress: () => NAME_POLICY,
}))

const SPONSOR = '0x5555555555555555555555555555555555555555'
const CONTROLLER = '0x6666666666666666666666666666666666666666'
const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const TEMPORARY_OWNER = '0x7777777777777777777777777777777777777777'
const TERMS = `0x${'11'.repeat(32)}` as const
const USD = 10n ** 18n
const ONE_DAY = 86400

const signTypedDataAsync = vi.fn()
const verifyTypedData = vi.fn()

const registrationData = {
  seconds: yearsToSeconds(2),
  queue: ['pricing', 'profile', 'info', 'transactions', 'complete'],
} as RegistrationReducerDataItem

const info = (data: RegistrationReducerDataItem, callback = vi.fn()) => (
  <Info
    name="alicebob.simplex"
    registrationData={data}
    callback={callback}
    onProfileClick={vi.fn()}
  />
)

const temporaryOwnerData: RegistrationReducerDataItem = {
  ...registrationData,
  secret: `0x${'33'.repeat(32)}`,
  resolverAddress: '0x9999999999999999999999999999999999999999',
  records: [],
  clearRecords: false,
  reverseRecord: false,
  referrer: zeroHash,
  terms: { kind: 'general', hash: TERMS },
  credit: { owner: TEMPORARY_OWNER },
}

const temporaryOwnerCommitment = makeCommitment({
  name: 'alicebob.simplex',
  owner: TEMPORARY_OWNER,
  duration: yearsToSeconds(2),
  secret: `0x${'33'.repeat(32)}`,
  resolverAddress: '0x9999999999999999999999999999999999999999',
  records: {},
  reverseRecord: 0,
  referrer: zeroHash,
})

const now = () => Math.floor(Date.now() / 1000)

const POLICY_NONCE = 3n
const SPONSOR_NONCE = 5n

const signedCredit = ({
  commitment = temporaryOwnerCommitment,
  deadline = BigInt(now() + 2 * ONE_DAY - 60),
  registerNonce = SPONSOR_NONCE,
}: { commitment?: `0x${string}`; deadline?: bigint; registerNonce?: bigint } = {}) => {
  const signature = `0x${'aa'.repeat(65)}` as const
  return {
    owner: TEMPORARY_OWNER,
    intents: {
      commitment,
      terms: {
        kind: 'general',
        hash: TERMS,
        intent: { nonce: POLICY_NONCE, deadline, signature },
      },
      register: { nonce: registerNonce, deadline, signature },
    },
  } as const
}

const readAllowance = (allowance: bigint) =>
  mockFunction(useReadContract).mockImplementation(((parameters: { functionName: string }) => ({
    data:
      parameters.functionName === 'registrarAllowance'
        ? allowance
        : { base: 100n * USD, premium: 0n },
    isLoading: false,
  })) as never)

const begin = async () => {
  await waitFor(() => expect(screen.getByTestId('next-button')).toBeEnabled())
  await userEvent.click(screen.getByTestId('next-button'))
}

describe('Info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFunction(usePublicClient).mockReturnValue({
      chain: { id: 1 },
      readContract: async ({ address }: { address: string }) =>
        address === NAME_POLICY ? 3n : 5n,
      verifyTypedData,
    } as never)
    mockFunction(useSignTypedData).mockReturnValue({ signTypedDataAsync } as never)
    signTypedDataAsync.mockImplementation(async ({ primaryType }: { primaryType: string }) =>
      primaryType === 'RegisterName' ? `0x${'bb'.repeat(65)}` : `0x${'aa'.repeat(65)}`,
    )
    verifyTypedData.mockResolvedValue(true)
    mockFunction(useAccountSafely).mockReturnValue({ address: '0x123' } as never)
    mockFunction(useEstimateFullRegistration).mockReturnValue({
      estimatedGasFee: 1n,
      estimatedGasLoading: false,
    } as never)
    readAllowance(1000n * USD)
  })

  it('the charge of a registration from the allowance, and the allowance left after it, are shown', () => {
    render(info({ ...registrationData, credit: { owner: '0x123' } }))
    expect(screen.queryByTestId('full-invoice')).not.toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeVisible()
    expect(screen.getByText('invoice.estimatedNetworkFee')).toBeVisible()
    expect(screen.getByText('invoice.allowanceLeft')).toBeVisible()
    expect(screen.getByText('$900.00')).toBeVisible()
    expect(screen.getByTestId('next-button')).toBeEnabled()
  })

  it('a registration from an allowance that no longer covers it cannot begin', () => {
    readAllowance(50n * USD)
    render(info({ ...registrationData, credit: { owner: '0x123' } }))
    expect(screen.getByTestId('next-button')).toBeDisabled()
    expect(screen.getByTestId('next-button')).toHaveTextContent('steps.pricing.allowanceTooLow')
  })

  it('a registration from the allowance cannot begin while the allowance is read', () => {
    mockFunction(useReadContract).mockReturnValue({ data: undefined, isLoading: true } as never)
    render(info({ ...registrationData, credit: { owner: '0x123' } }))
    expect(screen.getByTestId('next-button')).toBeDisabled()
  })

  it('a paid registration shows the ETH invoice', () => {
    render(info(registrationData))
    expect(screen.getByTestId('full-invoice')).toBeInTheDocument()
  })

  it('a temporary owner signs the terms and the registration of its name, for two days, then the registration begins', async () => {
    const callback = vi.fn()
    render(info(temporaryOwnerData, callback))
    expect(screen.getByText('steps.info.temporaryOwner')).toBeVisible()
    await begin()

    await waitFor(() => expect(callback).toHaveBeenCalled())
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: TEMPORARY_OWNER,
        primaryType: 'AcceptGeneralTerms',
        domain: expect.objectContaining({ verifyingContract: NAME_POLICY }),
        message: expect.objectContaining({
          commitment: temporaryOwnerCommitment,
          termsHash: TERMS,
          nonce: 3n,
        }),
      }),
    )
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: TEMPORARY_OWNER,
        primaryType: 'RegisterName',
        domain: expect.objectContaining({ verifyingContract: SPONSOR }),
        message: expect.objectContaining({ owner: TEMPORARY_OWNER, disputeDays: 14n, nonce: 5n }),
      }),
    )
    const deadline = expect.any(BigInt)
    expect(callback).toHaveBeenCalledWith({
      back: false,
      credit: {
        owner: TEMPORARY_OWNER,
        intents: {
          commitment: temporaryOwnerCommitment,
          terms: {
            kind: 'general',
            hash: TERMS,
            intent: { nonce: 3n, deadline, signature: `0x${'aa'.repeat(65)}` },
          },
          register: { nonce: 5n, deadline, signature: `0x${'bb'.repeat(65)}` },
        },
      },
    })
    const { register } = callback.mock.calls[0][0].credit.intents
    expect(Number(register.deadline) - now()).toBeGreaterThan(2 * ONE_DAY - 60)
  })

  it('a temporary owner signs the registration for the duration the registrar chose', async () => {
    const callback = vi.fn()
    render(info({ ...temporaryOwnerData, seconds: yearsToSeconds(11) }, callback))
    await begin()
    await waitFor(() => expect(callback).toHaveBeenCalled())
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryType: 'RegisterName',
        message: expect.objectContaining({ duration: BigInt(yearsToSeconds(11)) }),
      }),
    )
  })

  it('the registration begins without new signatures while those of the temporary owner hold for the commit', async () => {
    const callback = vi.fn()
    render(info({ ...temporaryOwnerData, credit: signedCredit() }, callback))
    await begin()
    expect(signTypedDataAsync).not.toHaveBeenCalled()
    expect(screen.queryByText('steps.info.temporaryOwner')).not.toBeInTheDocument()
    expect(callback).toHaveBeenCalledWith({ back: false })
  })

  it.each([
    ['another commitment', signedCredit({ commitment: `0x${'dd'.repeat(32)}` })],
    ['a deadline within the 24 hours of the commit', signedCredit({ deadline: BigInt(now()) })],
    [
      'a deadline within the commitment window and an hour',
      signedCredit({ deadline: BigInt(now() + 5 + 1800) }),
    ],
    ['a nonce used since', signedCredit({ registerNonce: SPONSOR_NONCE - 1n })],
  ])('a temporary owner signs again what it signed for %s', async (_, credit) => {
    const callback = vi.fn()
    render(info({ ...temporaryOwnerData, credit }, callback))
    await begin()
    await waitFor(() => expect(callback).toHaveBeenCalled())
    expect(signTypedDataAsync).toHaveBeenCalledTimes(2)
    expect(callback.mock.calls[0][0].credit.intents.commitment).toBe(temporaryOwnerCommitment)
  })

  it('a signature with v as 0 or 1 is kept with v as 27 or 28', async () => {
    signTypedDataAsync.mockResolvedValue(`0x${'aa'.repeat(64)}01`)
    const callback = vi.fn()
    render(info(temporaryOwnerData, callback))
    await begin()
    await waitFor(() => expect(callback).toHaveBeenCalled())
    expect(callback.mock.calls[0][0].credit.intents.register.signature).toBe(
      `0x${'aa'.repeat(64)}1c`,
    )
  })

  it('the reason why the temporary owner did not sign is shown, and the registration stays', async () => {
    signTypedDataAsync.mockRejectedValue(new BaseError('User rejected the request.'))
    const callback = vi.fn()
    render(info(temporaryOwnerData, callback))
    await begin()
    expect(await screen.findByText('User rejected the request.')).toBeVisible()
    expect(callback).not.toHaveBeenCalled()
  })

  it('a signature of another account than the temporary owner is refused', async () => {
    verifyTypedData.mockResolvedValue(false)
    const callback = vi.fn()
    render(info(temporaryOwnerData, callback))
    await begin()
    expect(await screen.findByText('errors.signedByAnotherAccount')).toBeVisible()
    expect(verifyTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEMPORARY_OWNER,
        signature: `0x${'aa'.repeat(65)}`,
        primaryType: 'AcceptGeneralTerms',
      }),
    )
    expect(callback).not.toHaveBeenCalled()
  })

  it('Back stays available while the wallet signs, and the registration does not begin once the step is left', async () => {
    let sign: (signature: string) => void = () => {}
    signTypedDataAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          sign = resolve
        }),
    )
    const callback = vi.fn()
    const { unmount } = render(info(temporaryOwnerData, callback))
    await begin()
    expect(screen.getByText('action.back').closest('button')).toBeEnabled()

    unmount()
    sign(`0x${'aa'.repeat(65)}`)
    await waitFor(() => expect(signTypedDataAsync).toHaveBeenCalledTimes(2))
    sign(`0x${'bb'.repeat(65)}`)
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(callback).not.toHaveBeenCalled()
  })
})
