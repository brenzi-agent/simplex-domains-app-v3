import { keccak256, parseAbi, toBytes } from 'viem'
import { useChainId, useReadContract, useReadContracts } from 'wagmi'

import { getNamePolicyAddress } from '@app/constants/chains'

const reservedAbi = parseAbi([
  'function reservedNames(bytes32) view returns (uint8)',
])

/**
 * Reads `SimplexNamePolicy.reservedNames(keccak256(label))` for a fully-qualified
 * name (the `.testing` / `.simplex` suffix is stripped before hashing).
 */
export const useReservedStatus = ({ name }: { name?: string }) => {
  const chainId = useChainId()
  const namePolicyAddress = getNamePolicyAddress(chainId)
  const label = name ? name.split('.')[0] : ''
  const enabled = !!namePolicyAddress && !!label

  const { data, isLoading } = useReadContract({
    address: enabled ? namePolicyAddress : undefined,
    abi: reservedAbi,
    functionName: 'reservedNames',
    args: enabled ? [keccak256(toBytes(label))] : undefined,
    query: { enabled, staleTime: 30_000 },
  })

  return {
    isReserved: !!data,
    loaded: enabled ? !isLoading : true,
  }
}

export const useReservedNames = ({ names }: { names: string[] }) => {
  const chainId = useChainId()
  const namePolicyAddress = getNamePolicyAddress(chainId)

  const { data, isLoading } = useReadContracts({
    contracts: names.map((name) => ({
      address: namePolicyAddress,
      abi: reservedAbi,
      functionName: 'reservedNames',
      args: [keccak256(toBytes(name.split('.')[0]))],
    })),
    allowFailure: false,
    query: { enabled: !!namePolicyAddress, staleTime: 30_000 },
  })

  return {
    reservedNames: names.filter((_, i) => !!data?.[i]),
    isLoading,
  }
}
