import { mockFunction, render, screen, userEvent } from '@app/test-utils'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { useChainName } from '@app/hooks/chain/useChainName'
import { useGasPrice } from '@app/hooks/chain/useGasPrice'
import { useRouterWithHistory } from '@app/hooks/useRouterWithHistory'
import { useGraphOutOfSync } from '@app/utils/SyncProvider/SyncProvider'

import { NetworkSection } from './MainMenu'

vi.mock('next/router', () => ({
  useRouter: () => ({ query: {} }),
}))
vi.mock('@app/hooks/chain/useChainName')
vi.mock('@app/hooks/chain/useGasPrice')
vi.mock('@app/hooks/useRouterWithHistory')
vi.mock('@app/utils/SyncProvider/SyncProvider')

const push = vi.fn()
mockFunction(useChainName).mockReturnValue('mainnet')
mockFunction(useGasPrice).mockReturnValue({ data: 80000000n })
mockFunction(useRouterWithHistory).mockReturnValue({ push })
mockFunction(useGraphOutOfSync).mockReturnValue(false)

afterEach(() => {
  vi.unstubAllEnvs()
  push.mockClear()
})

describe('NetworkSection', () => {
  it('opens the admin page from the TLD between the network and the gas price, shown as text', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'simplex')
    render(<NetworkSection />)
    const tld = screen.getByText('.simplex TLD')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('mainnet').compareDocumentPosition(tld)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(tld.compareDocumentPosition(screen.getByText(/ Gwei$/))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    await userEvent.click(tld)
    expect(push).toHaveBeenCalledWith('/admin')
  })

  it('names the TLD of the deployment', () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'testing')
    render(<NetworkSection />)
    expect(screen.getByText('.testing TLD')).toBeInTheDocument()
  })
})
