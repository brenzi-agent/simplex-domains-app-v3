import { mockFunction, render, screen } from '@app/test-utils'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReadContract } from 'wagmi'

import { useAccountSafely } from '@app/hooks/account/useAccountSafely'
import { yearsToSeconds } from '@app/utils/utils'

import { RegistrationReducerDataItem } from '../types'
import Info from './Info'

vi.mock('wagmi')
vi.mock('@app/hooks/account/useAccountSafely')
vi.mock('@app/hooks/gasEstimation/useEstimateRegistration')
vi.mock('../FullInvoice', () => ({ default: () => <div data-testid="full-invoice" /> }))
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ SimplexSponsor: SPONSOR, ETHRegistrarController: CONTROLLER }),
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

describe('Info', () => {
  beforeEach(() => {
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
})
