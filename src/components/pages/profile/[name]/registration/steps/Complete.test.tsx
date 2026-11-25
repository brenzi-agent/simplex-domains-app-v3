import { mockFunction, render, screen } from '@app/test-utils'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccount } from 'wagmi'

import { useRegistrationValueFromRegisterReceipt } from '@app/hooks/pages/register/useRegistrationValueFromRegisterReceipt'
import { useOnchainNftImage } from '@app/hooks/useOnchainNftImage'
import { useTransactionFlow } from '@app/transaction-flow/TransactionFlowProvider'

import { RegistrationReducerDataItem } from '../types'
import Complete from './Complete'

vi.mock('wagmi')
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@app/hooks/pages/register/useRegistrationValueFromRegisterReceipt')
vi.mock('@app/hooks/useOnchainNftImage')
vi.mock('@app/transaction-flow/TransactionFlowProvider')
vi.mock('@app/components/@molecules/NFTTemplate/NFTTemplate', () => ({ default: () => null }))

const SELECTED = '0x2222222222222222222222222222222222222222'
const TEMPORARY_OWNER = '0x7777777777777777777777777777777777777777'

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
      getLatestTransaction: () => undefined,
    } as never)
    mockFunction(useRegistrationValueFromRegisterReceipt).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never)
    mockFunction(useOnchainNftImage).mockReturnValue({ image: undefined } as never)
  })

  it('a name registered to the selected account is said to be its', () => {
    render(complete({ owner: SELECTED }))
    expect(screen.getByText('steps.complete.subheading')).toBeVisible()
    expect(screen.queryByText('steps.complete.registeredTo')).not.toBeInTheDocument()
  })

  it('a name registered to a temporary owner is said to be registered to it', () => {
    const intent = {
      nonce: 0n,
      deadline: 1_900_000_000n,
      signature: `0x${'ab'.repeat(65)}`,
    } as const
    render(
      complete({
        owner: TEMPORARY_OWNER,
        intents: { commitment: `0x${'cc'.repeat(32)}`, register: intent },
      }),
    )
    expect(screen.getByText('steps.complete.registeredTo')).toBeVisible()
    expect(screen.queryByText('steps.complete.subheading')).not.toBeInTheDocument()
  })
})
