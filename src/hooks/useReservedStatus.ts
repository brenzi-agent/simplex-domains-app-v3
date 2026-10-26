import { Address, keccak256, parseAbi, toBytes } from 'viem'
import { useChainId, useReadContract, useReadContracts } from 'wagmi'

import { getNamePolicy, getSnrcAddresses } from '@app/constants/chains'

const reservedAbi = parseAbi([
  'function reservedNames(bytes32) view returns (uint8)',
])

/**
 * Reads `SimplexNamePolicy.reservedNames(keccak256(label))` for a fully-qualified
 * name (the `.testing` / `.simplex` suffix is stripped before hashing).
 */
export const useReservedStatus = ({ name }: { name?: string }) => {
  const chainId = useChainId()
  const namePolicyAddress = getSnrcAddresses(chainId).SimplexNamePolicy as Address | undefined
  const label = name ? name.split('.')[0] : ''
  const enabled =
    !!namePolicyAddress &&
    namePolicyAddress !== '0x0000000000000000000000000000000000000000' &&
    !!label

  const { data, isLoading } = useReadContract({
    address: enabled ? namePolicyAddress! : undefined,
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
  const namePolicy = getNamePolicy(useChainId())

  const { data, isLoading } = useReadContracts({
    contracts: names.map((name) => ({
      address: namePolicy,
      abi: reservedAbi,
      functionName: 'reservedNames',
      args: [keccak256(toBytes(name.split('.')[0]))],
    })),
    allowFailure: false,
    query: { enabled: !!namePolicy, staleTime: 30_000 },
  })

  return {
    reservedNames: names.filter((_, i) => !!data?.[i]),
    isLoading,
  }
}
