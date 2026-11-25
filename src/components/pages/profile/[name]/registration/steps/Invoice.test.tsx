import { mockFunction, render, screen } from '@app/test-utils'

import { describe, expect, it, vi } from 'vitest'

import { useEthPrice } from '@app/hooks/useEthPrice'

import { Invoice } from './Invoice'

vi.mock('@app/hooks/useEthPrice')

describe('the registration invoice', () => {
  it('a charge to the allowance is shown in USD, beside the ETH fees', () => {
    mockFunction(useEthPrice).mockReturnValue({ data: 1n, isLoading: false })
    render(
      <Invoice
        name="alicebob.simplex"
        expiryTitle="invoice.expiry"
        expiryDate={new Date(0)}
        items={[
          { label: 'invoice.timeRegistration', usd: 100n * 10n ** 18n },
          { label: 'invoice.transactionFees', value: 10n ** 15n },
        ]}
      />,
    )
    expect(screen.getByTestId('invoice-item-0-amount-usd')).toHaveTextContent('$100.00')
    expect(screen.queryByTestId('invoice-item-0-amount')).not.toBeInTheDocument()
    expect(screen.getByTestId('invoice-item-1-amount')).toHaveTextContent('ETH')
  })
})
