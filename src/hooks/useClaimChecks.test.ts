import { mockFunction, renderHook } from '@app/test-utils'

import { describe, expect, it, vi } from 'vitest'

import { useQuery } from '@app/utils/query/useQuery'

import { useClaimChecks } from './useClaimChecks'

vi.mock('@app/utils/query/useQuery')
vi.mock('./useQueryOptions', () => ({
  useQueryOptions: () => ({ queryKey: ['getClaimChecks'], queryFn: vi.fn() }),
}))

const mockUseQuery = mockFunction(useQuery)

describe('useClaimChecks', () => {
  it('reads a fresh review on every mount and does not refetch it while it is on screen', () => {
    renderHook(() => useClaimChecks({ name: 'alice.testing' }))
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        gcTime: 0,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      }),
    )
  })
})
