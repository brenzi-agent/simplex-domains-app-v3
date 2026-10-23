import { mockFunction, renderHook } from '@app/test-utils'

import { useQueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { useBlockNumber } from 'wagmi'

import { useInvalidateOnBlock } from './useInvalidateOnBlock'

vi.mock('wagmi')
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQueryClient: vi.fn(),
}))

const mockUseBlockNumber = mockFunction(useBlockNumber)
const mockInvalidateQueries = vi.fn()
mockFunction(useQueryClient).mockReturnValue({ invalidateQueries: mockInvalidateQueries } as never)

describe('useInvalidateOnBlock', () => {
  it('invalidates on a new block without cancelling a refetch in flight', () => {
    mockUseBlockNumber.mockReturnValue({ data: 1n } as never)
    const { rerender } = renderHook(() => useInvalidateOnBlock({ queryKey: ['key'] }))
    mockUseBlockNumber.mockReturnValue({ data: 2n } as never)
    rerender()
    expect(mockInvalidateQueries).toHaveBeenLastCalledWith(
      { queryKey: ['key'] },
      { cancelRefetch: false },
    )
  })
})
