import { mockFunction, render, screen, userEvent, waitFor } from '@app/test-utils'

import { labelhash, zeroAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublicClient, useSignTypedData } from 'wagmi'

import { useConnectedHolder } from '@app/hooks/useNameOffer'

import { NameOfferBanner } from './NameOfferBanner'

const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const REGISTRAR = '0x1111111111111111111111111111111111111111'

const mockShowClaimNameInput = vi.fn()
const mockCreateTransactionFlow = vi.fn()
const signTypedDataAsync = vi.fn()

vi.mock('wagmi')
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))
vi.mock('@app/hooks/useNameOffer')
vi.mock('@app/transaction-flow/TransactionFlowProvider', () => ({
  useTransactionFlow: () => ({
    usePreparedDataInput: () => mockShowClaimNameInput,
    createTransactionFlow: mockCreateTransactionFlow,
  }),
}))

const mockUseConnectedHolder = mockFunction(useConnectedHolder)

const offer = (
  data: { recipient?: string; isHolder?: boolean; isRecipient?: boolean } | null,
  relayedHolder?: string,
) =>
  mockUseConnectedHolder.mockReturnValue({
    offer: { data: data && { holder: HOLDER, isHolder: false, isRecipient: false, ...data } },
    relayedHolder,
    isConnectedHolder: !!data?.isHolder || !!relayedHolder,
  } as unknown as ReturnType<typeof useConnectedHolder>)

describe('NameOfferBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFunction(usePublicClient).mockReturnValue({
      chain: { id: 1 },
      readContract: async () => 4n,
      verifyTypedData: async () => true,
    } as never)
    mockFunction(useSignTypedData).mockReturnValue({ signTypedDataAsync } as never)
    signTypedDataAsync.mockResolvedValue(`0x${'aa'.repeat(65)}`)
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
    expect(signTypedDataAsync).not.toHaveBeenCalled()
    expect(mockCreateTransactionFlow).toHaveBeenCalledWith('withdraw-offer-alice.testing', {
      transactions: [{ name: 'withdrawOffer', data: { name: 'alice.testing' } }],
    })
  })

  it('the holder, another connected account, signs the withdrawal, and the selected account sends it', async () => {
    offer({ recipient: RECIPIENT }, HOLDER)
    render(<NameOfferBanner name="alice.testing" />)
    await userEvent.click(screen.getByRole('button', { name: 'banner.offer.holder.action' }))
    await waitFor(() => expect(mockCreateTransactionFlow).toHaveBeenCalled())
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: HOLDER,
        primaryType: 'ApproveName',
        message: expect.objectContaining({
          from: HOLDER,
          to: zeroAddress,
          tokenId: BigInt(labelhash('alice')),
          nonce: 4n,
        }),
      }),
    )
    expect(mockCreateTransactionFlow).toHaveBeenCalledWith('withdraw-offer-alice.testing', {
      transactions: [
        {
          name: 'withdrawOffer',
          data: {
            name: 'alice.testing',
            intent: {
              signer: HOLDER,
              nonce: 4n,
              deadline: expect.any(BigInt),
              signature: `0x${'aa'.repeat(65)}`,
            },
          },
        },
      ],
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
