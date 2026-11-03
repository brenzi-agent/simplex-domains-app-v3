import { mockFunction, render, screen } from '@app/test-utils'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReadContract } from 'wagmi'

import { useControllerLimits } from '@app/hooks/useControllerLimits'
import { useNftGateStatus } from '@app/hooks/useNftGateStatus'
import { useReservedStatus } from '@app/hooks/useReservedStatus'

import { SimplexInfoPanel } from './SimplexInfoPanel'

vi.mock('wagmi')
vi.mock('@app/hooks/useControllerLimits')
vi.mock('@app/hooks/useNftGateStatus')
vi.mock('@app/hooks/useReservedStatus')

const mockUseReadContract = mockFunction(useReadContract)
const mockUseControllerLimits = mockFunction(useControllerLimits)
mockFunction(useNftGateStatus).mockReturnValue({ required: false } as never)
mockFunction(useReservedStatus).mockReturnValue({ isReserved: false } as never)

const ORACLE = '0x1111111111111111111111111111111111111111'
const curve = [
  1000n,
  [1n, 2n, 3n, 4n, 5n].map((labelLength) => ({
    labelLength,
    priceCentsPerYear: 1000n * 10n ** (6n - labelLength),
  })),
] as const

const tiers = () =>
  screen.queryAllByTestId(/^simplex-tier-/).map((card) => ({
    text: card.textContent,
    active: card.getAttribute('data-active'),
  }))

describe('SimplexInfoPanel', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows only the lengths the controller accepts, priced from the oracle', () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'simplex')
    mockUseControllerLimits.mockReturnValue({ minCharLength: 6, priceOracle: ORACLE } as never)
    mockUseReadContract.mockReturnValue({ data: curve } as never)
    render(<SimplexInfoPanel name="alice-name.simplex" />)
    expect(tiers()).toEqual([{ text: '6+ chars$10.00', active: 'true' }])
  })

  it('adds a card per shorter length once the minimum is lowered', () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'simplex')
    mockUseControllerLimits.mockReturnValue({ minCharLength: 4, priceOracle: ORACLE } as never)
    mockUseReadContract.mockReturnValue({ data: curve } as never)
    render(<SimplexInfoPanel name="alice.simplex" />)
    expect(tiers()).toEqual([
      { text: '6+ chars$10.00', active: 'false' },
      { text: '5 chars$100.00', active: 'true' },
      { text: '4 chars$1,000.00', active: 'false' },
    ])
  })

  it('shows no tiers on .testing and does not read the oracle', () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'testing')
    mockUseControllerLimits.mockReturnValue({ minCharLength: 6, priceOracle: ORACLE } as never)
    mockUseReadContract.mockReturnValue({ data: undefined } as never)
    render(<SimplexInfoPanel name="alice-name.testing" />)
    expect(tiers()).toEqual([])
    expect(mockUseReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: { enabled: false } }),
    )
  })
})
