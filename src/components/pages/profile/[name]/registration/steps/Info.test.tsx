import { mockFunction, render, screen } from '@app/test-utils'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReadContract } from 'wagmi'

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
}))

const SPONSOR = '0x5555555555555555555555555555555555555555'
const CONTROLLER = '0x6666666666666666666666666666666666666666'
const USD = 10n ** 18n

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

const readAllowance = (allowance: bigint) =>
  mockFunction(useReadContract).mockImplementation(((parameters: { functionName: string }) => ({
    data:
      parameters.functionName === 'registrarAllowance'
        ? allowance
        : { base: 100n * USD, premium: 0n },
    isLoading: false,
  })) as never)

describe('Info', () => {
  beforeEach(() => {
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

  it('a paid registration shows the ETH invoice', () => {
    render(info(registrationData))
    expect(screen.getByTestId('full-invoice')).toBeInTheDocument()
  })
})
