import { mockFunction, render, screen } from '@app/test-utils'

import { encodeAbiParameters, encodeEventTopics, parseAbi, parseAbiParameters } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccount } from 'wagmi'

import { useRegistrationValueFromRegisterReceipt } from '@app/hooks/pages/register/useRegistrationValueFromRegisterReceipt'
import { useEthPrice } from '@app/hooks/useEthPrice'
import { useOnchainNftImage } from '@app/hooks/useOnchainNftImage'
import { useTransactionFlow } from '@app/transaction-flow/TransactionFlowProvider'

import { RegistrationReducerDataItem } from '../types'
import Complete from './Complete'

vi.mock('wagmi')
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@app/hooks/pages/register/useRegistrationValueFromRegisterReceipt')
vi.mock('@app/hooks/useEthPrice')
vi.mock('@app/hooks/useOnchainNftImage')
vi.mock('@app/transaction-flow/TransactionFlowProvider')
vi.mock('@app/components/@molecules/NFTTemplate/NFTTemplate', () => ({ default: () => null }))

const SELECTED = '0x2222222222222222222222222222222222222222'
const SPONSOR = '0x5555555555555555555555555555555555555555'

const spentLog = {
  address: SPONSOR,
  topics: encodeEventTopics({
    abi: parseAbi([
      'event RegistrarAllowanceSpent(address indexed registrar, uint256 spentUSD, uint256 remainingUSD)',
    ]),
    eventName: 'RegistrarAllowanceSpent',
    args: { registrar: SELECTED },
  }),
  data: encodeAbiParameters(parseAbiParameters('uint256, uint256'), [
    100n * 10n ** 18n,
    900n * 10n ** 18n,
  ]),
}

const complete = (credit?: RegistrationReducerDataItem['credit']) => (
  <Complete
    name="alicebob.simplex"
    beautifiedName="alicebob.simplex"
    callback={vi.fn()}
    isMoonpayFlow={false}
    registrationData={
      { address: SELECTED, seconds: 63072000, credit } as RegistrationReducerDataItem
    }
  />
)

describe('Complete', () => {
  beforeEach(() => {
    mockFunction(useAccount).mockReturnValue({ address: SELECTED } as never)
    mockFunction(useTransactionFlow).mockReturnValue({
      getLatestTransaction: (key: string) => ({
        minedData: {
          gasUsed: 100_000n,
          effectiveGasPrice: 10n ** 9n,
          logs: key.startsWith('register-') ? [spentLog] : [],
        },
      }),
    } as never)
    mockFunction(useRegistrationValueFromRegisterReceipt).mockReturnValue({
      data: 10n ** 16n,
      isLoading: false,
    } as never)
    mockFunction(useEthPrice).mockReturnValue({ data: 1n, isLoading: false } as never)
    mockFunction(useOnchainNftImage).mockReturnValue({ image: undefined } as never)
  })

  it('the charge of a registration from the allowance is shown in USD', () => {
    render(complete({ owner: SELECTED }))
    expect(screen.getByTestId('invoice-item-0-amount-usd')).toHaveTextContent('$100.00')
    expect(screen.queryByTestId('invoice-item-0-amount')).not.toBeInTheDocument()
  })

  it('the cost of a paid registration is shown in ETH', () => {
    render(complete())
    expect(screen.getByTestId('invoice-item-0-amount')).toHaveTextContent('0.0100')
  })
})
