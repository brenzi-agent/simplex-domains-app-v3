import { mockFunction, render, screen, userEvent } from '@app/test-utils'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBytecode } from 'wagmi'

import { useNameOffer } from '@app/hooks/useNameOffer'

import { makeMockIntersectionObserver } from '../../../../test/mock/makeMockIntersectionObserver'
import OfferName from './OfferName-flow'

const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const EARLIER_RECIPIENT = '0x4444444444444444444444444444444444444444'

vi.mock('wagmi')
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
const mockUseNameOffer = mockFunction(useNameOffer)
const mockDispatch = vi.fn()

makeMockIntersectionObserver()

const offerTo = (recipient?: string) =>
  mockUseNameOffer.mockReturnValue({
    data: { holder: HOLDER, recipient, isHolder: true, isRecipient: false },
  } as unknown as ReturnType<typeof useNameOffer>)

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
    mockUseNameOffer.mockReturnValue({
      data: { holder: HOLDER, isHolder: true, isRecipient: false },
      isError: true,
    } as unknown as ReturnType<typeof useNameOffer>)
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
})
