import { Address, parseAbi } from 'viem'
import { useChainId, useReadContract } from 'wagmi'

import { getSnrcAddresses, getSponsorAddress } from '@app/constants/chains'
import { sponsorAbi } from '@app/utils/snrcSponsor'

import { useAccountSafely } from './account/useAccountSafely'

const rentPriceUsdAbi = parseAbi([
  'function rentPriceUSD(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
])

const coversPrice = (allowance?: bigint, price?: { base: bigint; premium: bigint }) => {
  if (allowance === undefined) return undefined
  if (allowance === 0n) return false
  if (!price) return undefined
  return price.base + price.premium <= allowance
}

export const useRegistrarAllowance = ({ name, seconds }: { name: string; seconds: number }) => {
  const chainId = useChainId()
  const { address } = useAccountSafely()
  const { ETHRegistrarController } = getSnrcAddresses(chainId)
  const sponsor = getSponsorAddress(chainId)
  const enabled = !!sponsor && !!address

  const allowance = useReadContract({
    address: sponsor,
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
    covers: coversPrice(allowance.data, price.data),
    loaded: !enabled || !allowance.isLoading,
  }
}
