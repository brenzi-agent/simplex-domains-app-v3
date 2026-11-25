import { mockFunction, render, screen, userEvent, waitFor } from '@app/test-utils'

import { BaseError, zeroHash } from 'viem'
import { readContract } from 'viem/actions'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublicClient, useReadContract, useSignTypedData } from 'wagmi'

import { makeCommitment } from '@ensdomains/ensjs/utils'

import { useAccountSafely } from '@app/hooks/account/useAccountSafely'
import { yearsToSeconds } from '@app/utils/utils'

import { RegistrationReducerDataItem } from '../types'
import Info from './Info'

vi.mock('wagmi')
vi.mock('viem/actions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readContract: vi.fn(),
}))
vi.mock('@app/hooks/account/useAccountSafely')
vi.mock('@app/hooks/gasEstimation/useEstimateRegistration')
vi.mock('../FullInvoice', () => ({ default: () => <div data-testid="full-invoice" /> }))
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ SimplexSponsor: SPONSOR, ETHRegistrarController: CONTROLLER }),
  getNamePolicyAddress: () => NAME_POLICY,
}))

const SPONSOR = '0x5555555555555555555555555555555555555555'
const CONTROLLER = '0x6666666666666666666666666666666666666666'
const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const PARTNER = '0x7777777777777777777777777777777777777777'
const TERMS = `0x${'11'.repeat(32)}` as const
const USD = 10n ** 18n

const signTypedDataAsync = vi.fn()

const registrationData = {
  seconds: yearsToSeconds(2),
  queue: ['pricing', 'profile', 'info', 'transactions', 'complete'],
} as RegistrationReducerDataItem

const info = (data: RegistrationReducerDataItem) => (
  <Info
    name="alicebob.simplex"
    registrationData={data}
    callback={vi.fn()}
    onProfileClick={vi.fn()}
  />
)

const partnerData: RegistrationReducerDataItem = {
  ...registrationData,
  secret: `0x${'33'.repeat(32)}`,
  resolverAddress: '0x9999999999999999999999999999999999999999',
  records: [],
  clearRecords: false,
  reverseRecord: false,
  referrer: zeroHash,
  terms: { kind: 'general', hash: TERMS },
  credit: { disputeDays: 14, partner: { owner: PARTNER } },
}

const partnerCommitment = makeCommitment({
  name: 'alicebob.simplex',
  owner: PARTNER,
  duration: yearsToSeconds(2),
  secret: `0x${'33'.repeat(32)}`,
  resolverAddress: '0x9999999999999999999999999999999999999999',
  records: {},
  reverseRecord: 0,
  referrer: zeroHash,
})

describe('Info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFunction(usePublicClient).mockReturnValue({ chain: { id: 1 } } as never)
    mockFunction(useSignTypedData).mockReturnValue({ signTypedDataAsync } as never)
    vi.mocked(readContract).mockImplementation((async (
      _client: unknown,
      parameters: { address: string },
    ) => (parameters.address === NAME_POLICY ? 3n : 5n)) as unknown as typeof readContract)
    signTypedDataAsync.mockImplementation(async ({ primaryType }: { primaryType: string }) =>
      primaryType === 'RegisterName' ? `0x${'bb'.repeat(65)}` : `0x${'aa'.repeat(65)}`,
    )
    mockFunction(useAccountSafely).mockReturnValue({ address: '0x123' } as never)
    mockFunction(useReadContract).mockImplementation(((parameters: { functionName: string }) => ({
      data:
        parameters.functionName === 'registrarAllowance'
          ? 1000n * USD
          : { base: 100n * USD, premium: 0n },
      isLoading: false,
    })) as never)
  })

  it('shows what a registration from the allowance costs it, and what it leaves', () => {
    render(info({ ...registrationData, credit: { disputeDays: 14 } }))
    expect(screen.queryByTestId('full-invoice')).not.toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeVisible()
    expect(screen.getByText('invoice.allowanceLeft')).toBeVisible()
    expect(screen.getByText('$1,000.00')).toBeVisible()
  })

  it('shows the ETH invoice for a paid registration', () => {
    render(info(registrationData))
    expect(screen.getByTestId('full-invoice')).toBeInTheDocument()
  })

  it('has the partner sign the terms and the registration of its name, then begins', async () => {
    const callback = vi.fn()
    render(
      <Info
        name="alicebob.simplex"
        registrationData={partnerData}
        callback={callback}
        onProfileClick={vi.fn()}
      />,
    )
    expect(screen.getByText('steps.info.partner')).toBeVisible()
    await userEvent.click(screen.getByTestId('next-button'))

    await waitFor(() => expect(callback).toHaveBeenCalled())
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: PARTNER,
        primaryType: 'AcceptGeneralTerms',
        domain: expect.objectContaining({ verifyingContract: NAME_POLICY }),
        message: expect.objectContaining({
          commitment: partnerCommitment,
          termsHash: TERMS,
          nonce: 3n,
        }),
      }),
    )
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: PARTNER,
        primaryType: 'RegisterName',
        domain: expect.objectContaining({ verifyingContract: SPONSOR }),
        message: expect.objectContaining({ owner: PARTNER, disputeDays: 14n, nonce: 5n }),
      }),
    )
    const intent = { signer: PARTNER, deadline: expect.any(BigInt) }
    expect(callback).toHaveBeenCalledWith({
      back: false,
      credit: {
        disputeDays: 14,
        partner: {
          owner: PARTNER,
          intents: {
            commitment: partnerCommitment,
            terms: { ...intent, nonce: 3n, signature: `0x${'aa'.repeat(65)}` },
            register: { ...intent, nonce: 5n, signature: `0x${'bb'.repeat(65)}` },
          },
        },
      },
    })
  })

  it('begins without new signatures while the partner signatures for the commitment hold', async () => {
    const callback = vi.fn()
    const signed = {
      signer: PARTNER,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      signature: `0x${'aa'.repeat(65)}`,
    } as const
    render(
      <Info
        name="alicebob.simplex"
        registrationData={{
          ...partnerData,
          credit: {
            disputeDays: 14,
            partner: {
              owner: PARTNER,
              intents: { commitment: partnerCommitment, terms: signed, register: signed },
            },
          },
        }}
        callback={callback}
        onProfileClick={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('next-button'))
    expect(signTypedDataAsync).not.toHaveBeenCalled()
    expect(callback).toHaveBeenCalledWith({ back: false })
  })

  it('says why the partner did not sign, and stays', async () => {
    signTypedDataAsync.mockRejectedValue(new BaseError('User rejected the request.'))
    const callback = vi.fn()
    render(
      <Info
        name="alicebob.simplex"
        registrationData={partnerData}
        callback={callback}
        onProfileClick={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('next-button'))
    expect(await screen.findByText('User rejected the request.')).toBeVisible()
    expect(callback).not.toHaveBeenCalled()
  })
})
