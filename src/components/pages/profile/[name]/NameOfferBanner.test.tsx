import { mockFunction, render, screen, userEvent } from '@app/test-utils'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNameOffer } from '@app/hooks/useNameOffer'

import { NameOfferBanner } from './NameOfferBanner'

const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'

const mockShowClaimNameInput = vi.fn()
const mockCreateTransactionFlow = vi.fn()

vi.mock('@app/hooks/useNameOffer')
vi.mock('@app/transaction-flow/TransactionFlowProvider', () => ({
  useTransactionFlow: () => ({
    usePreparedDataInput: () => mockShowClaimNameInput,
    createTransactionFlow: mockCreateTransactionFlow,
  }),
}))

const mockUseNameOffer = mockFunction(useNameOffer)

const offer = (data: { recipient?: string; isHolder?: boolean; isRecipient?: boolean } | null) =>
  mockUseNameOffer.mockReturnValue({
    data: data && { holder: HOLDER, isHolder: false, isRecipient: false, ...data },
  } as unknown as ReturnType<typeof useNameOffer>)

describe('NameOfferBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets the recipient review and claim the name', async () => {
    offer({ recipient: RECIPIENT, isRecipient: true })
    render(<NameOfferBanner name="alice.testing" />)
    await userEvent.click(screen.getByRole('button', { name: 'banner.offer.recipient.action' }))
    expect(mockShowClaimNameInput).toHaveBeenCalledWith('claim-name-alice.testing', {
      name: 'alice.testing',
    })
  })

  it('lets the holder withdraw the offer', async () => {
    offer({ recipient: RECIPIENT, isHolder: true })
    render(<NameOfferBanner name="alice.testing" />)
    await userEvent.click(screen.getByRole('button', { name: 'banner.offer.holder.action' }))
    expect(mockCreateTransactionFlow).toHaveBeenCalledWith('withdraw-offer-alice.testing', {
      transactions: [{ name: 'withdrawOffer', data: { name: 'alice.testing' } }],
    })
  })

  it('shows nothing to anyone else, or when nothing is offered', () => {
    offer({ recipient: RECIPIENT })
    const { container, rerender } = render(<NameOfferBanner name="alice.testing" />)
    expect(container).toBeEmptyDOMElement()
    offer({ isHolder: true })
    rerender(<NameOfferBanner name="alice.testing" />)
    expect(container).toBeEmptyDOMElement()
    offer(null)
    rerender(<NameOfferBanner name="alice.testing" />)
    expect(container).toBeEmptyDOMElement()
  })
})
