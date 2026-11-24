import { mockFunction, render, screen } from '@app/test-utils'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { useChainName } from '@app/hooks/chain/useChainName'
import { useGasPrice } from '@app/hooks/chain/useGasPrice'
import { useGraphOutOfSync } from '@app/utils/SyncProvider/SyncProvider'

import { NetworkSection } from './MainMenu'

vi.mock('next/router', () => ({
  useRouter: () => ({ query: {} }),
}))
vi.mock('@app/hooks/chain/useChainName')
vi.mock('@app/hooks/chain/useGasPrice')
vi.mock('@app/utils/SyncProvider/SyncProvider')

mockFunction(useChainName).mockReturnValue('mainnet')
mockFunction(useGasPrice).mockReturnValue({ data: 80000000n })
mockFunction(useGraphOutOfSync).mockReturnValue(false)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('NetworkSection', () => {
  it('links the admin page from the TLD between the network and the gas price', () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'simplex')
    render(<NetworkSection />)
    const tld = screen.getByRole('link', { name: '.simplex TLD' })
    expect(tld).toHaveAttribute('href', '/admin')
    expect(screen.getByText('mainnet').compareDocumentPosition(tld)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(tld.compareDocumentPosition(screen.getByText(/ Gwei$/))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('names the TLD of the deployment', () => {
    vi.stubEnv('NEXT_PUBLIC_SIMPLEX_TLD', 'testing')
    render(<NetworkSection />)
    expect(screen.getByRole('link', { name: '.testing TLD' })).toHaveAttribute('href', '/admin')
  })
})
