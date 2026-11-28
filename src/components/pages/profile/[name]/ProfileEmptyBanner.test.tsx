import { mockFunction, render, screen, userEvent, within } from '@app/test-utils'

import { describe, expect, it, vi } from 'vitest'

import { Banner } from '@ensdomains/thorin'

import { useAbilities } from '@app/hooks/abilities/useAbilities'
import { useProfileActions } from '@app/hooks/pages/profile/[name]/profile/useProfileActions/useProfileActions'
import { useProfile } from '@app/hooks/useProfile'

import { ProfileEmptyBanner } from './ProfileEmptyBanner'

vi.mock('@app/hooks/useProtectedRoute', () => ({
  useProtectedRoute: vi.fn(),
}))
vi.mock('@app/utils/BreakpointProvider')
vi.mock('next/router', async () => await vi.importActual('next-router-mock'))
vi.mock('@app/hooks/useProfile')
vi.mock('@app/hooks/pages/profile/[name]/profile/useProfileActions/useProfileActions')
vi.mock('@app/hooks/abilities/useAbilities', () => ({
  useAbilities: vi.fn(() => ({ data: { canEditRecords: true } })),
}))
vi.mock('@ensdomains/thorin', async (importOriginal) => {
  const thorin = await importOriginal<typeof import('@ensdomains/thorin')>()
  const { createElement } = await import('react')
  return {
    ...thorin,
    Banner: vi.fn((props: Parameters<typeof thorin.Banner>[0]) =>
      createElement(thorin.Banner, props),
    ),
  }
})

const mockUseAbilities = mockFunction(useAbilities)
const mockUseProfile = mockFunction(useProfile)
const mockUseProfileActions = mockFunction(useProfileActions)
const mockBanner = mockFunction(Banner)

describe('ProfileEmptyBanner', () => {
  it('should not display banner if a simplex link is set', () => {
    const name = 'test'

    mockUseProfile.mockImplementation(() => ({
      data: {
        texts: [
          {
            key: 'avatar',
            value: 'http://localhost:3000',
          },
          {
            key: 'simplex.contact',
            value: 'smp://example',
          },
        ],
        coins: [
          {
            id: 60,
            name: 'eth',
            value: '0x8327FcD61f5e90e1E05A3F49DCbc9346b7d111111',
          },
        ],
        contentHash: null,
        abi: null,
        resolverAddress: '0x8327FcD61f5e90e1E05A3F49DCbc9346b7d111112',
        isMigrated: true,
        createdAt: {
          date: '2024-08-02T10:33:00.000Z',
          value: 1722594780000,
        },
        address: '0x8327FcD61f5e90e1E05A3F49DCbc9346b7d175f7',
      },
      isLoading: false,
    }))

    mockUseProfileActions.mockImplementation(() => ({
      profileActions: [
        {
          label: 'tabs.profile.actions.editProfile.label',
        },
      ],
    }))

    render(<ProfileEmptyBanner name={name} />)
    expect(screen.queryByTestId('profile-empty-banner')).not.toBeInTheDocument()
  })

  it('should display banner if records exist but no simplex link is set', () => {
    const name = 'test'

    mockUseProfile.mockImplementation(() => ({
      data: {
        texts: [{ key: 'avatar', value: 'http://localhost:3000' }],
        coins: [{ id: 60, name: 'eth', value: '0x8327FcD61f5e90e1E05A3F49DCbc9346b7d111111' }],
      },
      isLoading: false,
    }))

    mockUseProfileActions.mockImplementation(() => ({
      profileActions: [
        {
          label: 'tabs.profile.actions.editProfile.label',
        },
      ],
    }))

    render(<ProfileEmptyBanner name={name} />)
    expect(screen.queryByTestId('profile-empty-banner')).toBeInTheDocument()
  })

  it('should display banner if have no records', () => {
    const name = 'test'

    mockUseProfile.mockImplementation(() => ({
      data: {
        text: [],
        coins: [],
      },
      isLoading: false,
    }))

    mockUseProfileActions.mockImplementation(() => ({
      profileActions: [
        {
          label: 'tabs.profile.actions.editProfile.label',
        },
      ],
    }))

    render(<ProfileEmptyBanner name={name} />)
    expect(screen.queryByTestId('profile-empty-banner')).toBeInTheDocument()
  })

  it('should display the prompt as a plain info banner whose action edits the profile', async () => {
    const editProfile = vi.fn()

    mockUseProfile.mockImplementation(() => ({
      data: {
        texts: [],
        coins: [],
      },
      isLoading: false,
    }))

    mockUseProfileActions.mockImplementation(() => ({
      profileActions: [
        {
          label: 'tabs.profile.actions.editProfile.label',
          onClick: editProfile,
        },
      ],
    }))

    mockBanner.mockClear()
    render(<ProfileEmptyBanner name="test" />)
    expect(mockBanner.mock.lastCall?.[0]).toMatchObject({
      alert: 'info',
      title: 'banner.empty.title',
    })
    const banner = screen.getByTestId('profile-empty-banner')
    expect(banner).toHaveTextContent('banner.empty.description')
    await userEvent.click(within(banner).getByRole('button', { name: 'banner.empty.action' }))
    expect(editProfile).toHaveBeenCalledOnce()
  })

  it('should not display banner if cannot edit records', () => {
    const name = 'test'

    mockUseProfile.mockImplementation(() => ({
      data: {
        text: [],
        coins: [],
      },
      isLoading: false,
    }))

    mockUseProfileActions.mockImplementation(() => ({
      profileActions: [
        {
          label: 'tabs.profile.actions.editProfile.label',
        },
      ],
    }))

    mockUseAbilities.mockImplementationOnce(() => ({
      data: {
        canEditRecords: false,
      },
    }))

    render(<ProfileEmptyBanner name={name} />)
    expect(screen.queryByTestId('profile-empty-banner')).not.toBeInTheDocument()
  })
})
