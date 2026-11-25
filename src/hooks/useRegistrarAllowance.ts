import { Address, parseAbi } from 'viem'
import { useChainId, useReadContract } from 'wagmi'

import { getSnrcAddresses } from '@app/constants/chains'
import { sponsorAbi } from '@app/utils/snrcSponsor'

import { useAccountSafely } from './account/useAccountSafely'

const rentPriceUsdAbi = parseAbi([
  'function rentPriceUSD(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
])

export const useRegistrarAllowance = ({ name, seconds }: { name: string; seconds: number }) => {
  const chainId = useChainId()
  const { address } = useAccountSafely()
  const { SimplexSponsor, ETHRegistrarController } = getSnrcAddresses(chainId)
  const enabled = !!SimplexSponsor && !!address

  const allowance = useReadContract({
    address: SimplexSponsor as Address | undefined,
    abi: sponsorAbi,
    functionName: 'registrarAllowance',
    args: address ? [address] : undefined,
    query: { enabled },
  })

  const price = useReadContract({
    address: ETHRegistrarController as Address | undefined,
    abi: rentPriceUsdAbi,
    functionName: 'rentPriceUSD',
    args: [name.split('.')[0], BigInt(seconds)],
    query: { enabled: !!allowance.data },
  })

  return {
    allowance: allowance.data,
    price: price.data,
    loaded: !enabled || !allowance.isLoading,
  }
}
