import { mockFunction, renderHook } from '@app/test-utils'

import { keccak256, toBytes } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChainId, useReadContracts } from 'wagmi'

import { useReservedNames } from './useReservedStatus'

vi.mock('wagmi')
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => NAME_POLICY,
}))

const NAME_POLICY = '0x4444444444444444444444444444444444444444'

const mockUseChainId = mockFunction(useChainId)
const mockUseReadContracts = mockFunction(useReadContracts)

describe('useReservedNames', () => {
  beforeEach(() => {
    mockUseChainId.mockReturnValue(1337)
  })

  it('returns the names the name policy holds reserved', () => {
    mockUseReadContracts.mockReturnValue({ data: [0, 2], isLoading: false } as never)
    const { result } = renderHook(() =>
      useReservedNames({ names: ['alice.simplex', 'brand.simplex'] }),
    )
    expect(mockUseReadContracts).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: ['alice', 'brand'].map((label) =>
          expect.objectContaining({
            address: NAME_POLICY,
            functionName: 'reservedNames',
            args: [keccak256(toBytes(label))],
          }),
        ),
      }),
    )
    expect(result.current).toEqual({ reservedNames: ['brand.simplex'], isLoading: false })
  })
})
