import { act, mockFunction, render, screen, userEvent, waitFor } from '@app/test-utils'

import { describe, expect, it, vi } from 'vitest'

import { useInitial } from '@app/hooks/useInitial'
import { useBreakpoint } from '@app/utils/BreakpointProvider'
import { useGraphOutOfSync } from '@app/utils/SyncProvider/SyncProvider'

import Hamburger from './Hamburger'

const { routeChangeStart } = vi.hoisted(() => ({ routeChangeStart: new Set<() => void>() }))

vi.mock('next/router', () => ({
  useRouter: () => ({
    events: {
      on: (event: string, handler: () => void) => {
        if (event === 'routeChangeStart') routeChangeStart.add(handler)
      },
      off: (event: string, handler: () => void) => {
        if (event === 'routeChangeStart') routeChangeStart.delete(handler)
      },
    },
  }),
}))
vi.mock('@app/hooks/useInitial')
vi.mock('@app/utils/BreakpointProvider')
vi.mock('@app/utils/SyncProvider/SyncProvider')
vi.mock('./MainMenu', () => ({ default: () => <div>main menu</div> }))

mockFunction(useInitial).mockReturnValue(false)
mockFunction(useBreakpoint).mockReturnValue({ sm: false })
mockFunction(useGraphOutOfSync).mockReturnValue(false)

describe('Hamburger', () => {
  it('closes its menu when a route change starts, as on a click of a link in it', async () => {
    render(<Hamburger />)
    await userEvent.click(screen.getByRole('button'))
    expect(await screen.findByText('main menu')).toBeInTheDocument()
    act(() => routeChangeStart.forEach((handler) => handler()))
    await waitFor(() => expect(screen.queryByText('main menu')).not.toBeInTheDocument())
  })
})
