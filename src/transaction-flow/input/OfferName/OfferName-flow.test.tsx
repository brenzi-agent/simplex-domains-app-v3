import { mockFunction, render, screen, userEvent, waitFor } from '@app/test-utils'

import { BaseError, labelhash } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBytecode, usePublicClient, useSignTypedData } from 'wagmi'

import { useConnectedHolder } from '@app/hooks/useNameOffer'

import { makeMockIntersectionObserver } from '../../../../test/mock/makeMockIntersectionObserver'
import OfferName from './OfferName-flow'

const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const EARLIER_RECIPIENT = '0x4444444444444444444444444444444444444444'
const REGISTRAR = '0x1111111111111111111111111111111111111111'
const signTypedDataAsync = vi.fn()
const readContract = vi.fn(async () => 2n)

vi.mock('wagmi')
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))
vi.mock('@app/hooks/useNameOffer')
vi.mock('../SendName/views/SearchView/SearchView', () => ({
  SearchView: ({
    title,
    subtitle,
    onSelect,
  }: {
    title: string
    subtitle: string
    onSelect: (address: string) => void
  }) => (
    <button type="button" data-testid="select-recipient" onClick={() => onSelect(RECIPIENT)}>
      {title} {subtitle}
    </button>
  ),
}))
vi.mock('@app/components/@molecules/AvatarWithIdentifier/AvatarWithIdentifier', () => ({
  AvatarWithIdentifier: ({ address }: { address: string }) => <span>{address}</span>,
}))

const mockUseBytecode = mockFunction(useBytecode)
const mockUseConnectedHolder = mockFunction(useConnectedHolder)
const mockDispatch = vi.fn()

makeMockIntersectionObserver()

const connectedHolder = (
  offer: { data: object; isError?: boolean },
  relayedHolder?: string,
) =>
  mockUseConnectedHolder.mockReturnValue({
    offer,
    relayedHolder,
    isConnectedHolder: true,
  } as unknown as ReturnType<typeof useConnectedHolder>)

const offerTo = (recipient?: string) =>
  connectedHolder({ data: { holder: HOLDER, recipient, isHolder: true, isRecipient: false } })

const renderAndSelect = async () => {
  render(
    <OfferName data={{ name: 'alice.testing' }} dispatch={mockDispatch} onDismiss={() => {}} />,
  )
  await userEvent.click(screen.getByTestId('select-recipient'))
}

describe('OfferName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    offerTo(undefined)
    mockUseBytecode.mockReturnValue({ data: undefined, isSuccess: true } as never)
    mockFunction(usePublicClient).mockReturnValue({
      chain: { id: 1 },
      readContract,
      verifyTypedData: async () => true,
    } as never)
    mockFunction(useSignTypedData).mockReturnValue({ signTypedDataAsync } as never)
    signTypedDataAsync.mockResolvedValue(`0x${'aa'.repeat(65)}`)
  })

  it('asks for the recipient under the offer title', () => {
    render(
      <OfferName data={{ name: 'alice.testing' }} dispatch={mockDispatch} onDismiss={() => {}} />,
    )
    expect(screen.getByTestId('select-recipient')).toHaveTextContent(
      'input.offerName.title input.offerName.recipient',
    )
  })

  it('offers the name to the selected recipient', async () => {
    await renderAndSelect()
    await userEvent.click(screen.getByTestId('offer-name-confirm'))
    expect(mockDispatch).toHaveBeenCalledWith({
      name: 'setTransactions',
      payload: [{ name: 'offerName', data: { name: 'alice.testing', recipient: RECIPIENT } }],
    })
  })

  it('waits for the recipient code and warns about a contract', async () => {
    mockUseBytecode.mockReturnValue({ data: undefined, isSuccess: false } as never)
    await renderAndSelect()
    expect(screen.getByTestId('offer-name-confirm')).toBeDisabled()

    mockUseBytecode.mockReturnValue({ data: '0x6080', isSuccess: true } as never)
    await userEvent.click(screen.getByText('action.back'))
    await userEvent.click(screen.getByTestId('select-recipient'))
    expect(screen.getByText('input.offerName.contract')).toBeVisible()
    expect(screen.getByTestId('offer-name-confirm')).toBeEnabled()
  })

  it('does not warn about an account delegated under EIP-7702', async () => {
    mockUseBytecode.mockReturnValue({
      data: `0xef0100${'11'.repeat(20)}`,
      isSuccess: true,
    } as never)
    await renderAndSelect()
    expect(screen.queryByText('input.offerName.contract')).not.toBeInTheDocument()
  })

  it('says so and disables Next when the offer or the recipient code cannot be read', async () => {
    mockUseBytecode.mockReturnValue({ data: undefined, isSuccess: false, isError: true } as never)
    await renderAndSelect()
    expect(screen.getByText('input.offerName.failed')).toBeVisible()
    expect(screen.getByTestId('offer-name-confirm')).toBeDisabled()

    mockUseBytecode.mockReturnValue({ data: undefined, isSuccess: true } as never)
    connectedHolder({ data: { holder: HOLDER, isHolder: true, isRecipient: false }, isError: true })
    await userEvent.click(screen.getByText('action.back'))
    await userEvent.click(screen.getByTestId('select-recipient'))
    expect(screen.getByText('input.offerName.failed')).toBeVisible()
    expect(screen.getByTestId('offer-name-confirm')).toBeDisabled()
  })

  it('notes a replaced offer only when it was to someone else', async () => {
    offerTo(EARLIER_RECIPIENT)
    await renderAndSelect()
    expect(screen.getByText('input.offerName.replaces')).toBeVisible()

    offerTo(RECIPIENT)
    await userEvent.click(screen.getByText('action.back'))
    await userEvent.click(screen.getByTestId('select-recipient'))
    expect(screen.queryByText('input.offerName.replaces')).not.toBeInTheDocument()
  })

  const heldByAnotherConnectedAccount = () =>
    connectedHolder({ data: { holder: HOLDER, isHolder: false, isRecipient: false } }, HOLDER)

  it('the holder, another connected account, signs the offer, and the selected account sends it', async () => {
    heldByAnotherConnectedAccount()
    await renderAndSelect()
    expect(screen.getByText('input.offerName.relayed')).toBeVisible()
    await userEvent.click(screen.getByTestId('offer-name-confirm'))

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        name: 'setTransactions',
        payload: [
          {
            name: 'offerName',
            data: {
              name: 'alice.testing',
              recipient: RECIPIENT,
              intent: {
                signer: HOLDER,
                nonce: 2n,
                deadline: expect.any(BigInt),
                signature: `0x${'aa'.repeat(65)}`,
              },
            },
          },
        ],
      }),
    )
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: REGISTRAR, functionName: 'nonces', args: [HOLDER] }),
    )
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: HOLDER,
        primaryType: 'ApproveName',
        domain: expect.objectContaining({ verifyingContract: REGISTRAR }),
        message: expect.objectContaining({
          from: HOLDER,
          to: RECIPIENT,
          tokenId: BigInt(labelhash('alice')),
          nonce: 2n,
        }),
      }),
    )
  })

  it('the reason why the holder did not sign the offer is shown, and nothing is offered', async () => {
    heldByAnotherConnectedAccount()
    signTypedDataAsync.mockRejectedValue(new BaseError('User rejected the request.'))
    await renderAndSelect()
    await userEvent.click(screen.getByTestId('offer-name-confirm'))
    expect(await screen.findByText('User rejected the request.')).toBeVisible()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
