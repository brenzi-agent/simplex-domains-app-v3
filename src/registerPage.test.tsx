import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccount, useChainId } from 'wagmi'

import { useInitial } from '@app/hooks/useInitial'
import { useNameDetails } from '@app/hooks/useNameDetails'
import { useRouterWithHistory } from '@app/hooks/useRouterWithHistory'

import Page from './pages/register'

vi.mock('wagmi')
vi.mock('@app/utils/query/wagmi', () => ({ wagmiConfig: {} }))
vi.mock('@app/hooks/useInitial')
vi.mock('@app/hooks/useNameDetails')
vi.mock('@app/hooks/useRouterWithHistory')
vi.mock('@app/components/pages/profile/[name]/registration/Registration', () => ({
  default: () => <div data-testid="registration" />,
}))

const NAME = 'alicebob.simplex'
const W0 = '0x1111111111111111111111111111111111111111'
const WN = '0x2222222222222222222222222222222222222222'
const OTHER = '0x3333333333333333333333333333333333333333'

const push = vi.fn()

const nameOwnedBy = (owner: string) =>
  vi.mocked(useNameDetails).mockReturnValue({
    isLoading: false,
    registrationStatus: 'registered',
    normalisedName: NAME,
    ownerData: { owner },
  } as never)

const storeRegistration = (credit?: { owner: string }) =>
  localStorage.setItem(
    'registration-status',
    JSON.stringify({
      items: [
        {
          address: W0,
          name: NAME,
          chainId: 1,
          version: 5,
          stepIndex: 4,
          queue: ['pricing', 'profile', 'info', 'transactions', 'complete'],
          credit,
        },
      ],
    }),
  )

describe('register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(useRouterWithHistory).mockReturnValue({
      asPath: `/register/${NAME}`,
      query: { name: NAME },
      push,
    } as never)
    vi.mocked(useInitial).mockReturnValue(false)
    vi.mocked(useAccount).mockReturnValue({ address: W0 } as never)
    vi.mocked(useChainId).mockReturnValue(1)
  })

  it('the account that registered a name to another account of the wallet stays on Complete', () => {
    nameOwnedBy(WN)
    storeRegistration({ owner: WN })
    render(<Page />)
    expect(screen.getByTestId('registration')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('the account that registered a name to itself stays on Complete', () => {
    nameOwnedBy(W0)
    storeRegistration({ owner: W0 })
    render(<Page />)
    expect(push).not.toHaveBeenCalled()
  })

  it('a name owned by an account other than the one it was registered to opens on its profile', () => {
    nameOwnedBy(OTHER)
    storeRegistration({ owner: WN })
    render(<Page />)
    expect(push).toHaveBeenCalledWith(`/profile/${NAME}`)
  })

  it('a registered name without a registration of this account opens on its profile', () => {
    nameOwnedBy(WN)
    render(<Page />)
    expect(push).toHaveBeenCalledWith(`/profile/${NAME}`)
  })
})
