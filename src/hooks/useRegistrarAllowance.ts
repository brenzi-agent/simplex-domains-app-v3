import { Address, parseAbi } from 'viem'
import { useChainId, useReadContract } from 'wagmi'

import { getSnrcAddresses, getSponsorAddress } from '@app/constants/chains'
import { sponsorAbi } from '@app/utils/snrcSponsor'

import { useAccountSafely } from './account/useAccountSafely'

const rentPriceUsdAbi = parseAbi([
  'function rentPriceUSD(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
])

export type AllowanceStatus = 'loading' | 'error' | 'none' | 'allowance'

const getAllowanceStatus = ({
  enabled,
  data,
  isError,
}: {
  enabled: boolean
  data?: bigint
  isError: boolean
}): AllowanceStatus => {
  if (!enabled) return 'none'
  if (data !== undefined) return data > 0n ? 'allowance' : 'none'
  return isError ? 'error' : 'loading'
}

const coversPrice = (allowance?: bigint, price?: { base: bigint; premium: bigint }) => {
  if (allowance === undefined) return undefined
  if (allowance === 0n) return false
  if (!price) return undefined
  return price.base + price.premium <= allowance
}

export const useAccountAllowance = () => {
  const chainId = useChainId()
  const { address } = useAccountSafely()
  const sponsor = getSponsorAddress(chainId)
  const enabled = !!sponsor && !!address

  const allowance = useReadContract({
    address: sponsor,
    abi: sponsorAbi,
    functionName: 'registrarAllowance',
    args: address ? [address] : undefined,
    query: { enabled },
  })
  return { allowance, enabled }
}

export const useRegistrarAllowance = ({ name, seconds }: { name: string; seconds: number }) => {
  const chainId = useChainId()
  const { ETHRegistrarController } = getSnrcAddresses(chainId)
  const { allowance, enabled } = useAccountAllowance()

  const price = useReadContract({
    address: ETHRegistrarController as Address | undefined,
    abi: rentPriceUsdAbi,
    functionName: 'rentPriceUSD',
    args: [name.split('.')[0], BigInt(seconds)],
    query: { enabled },
  })

  return {
    status: getAllowanceStatus({ enabled, data: allowance.data, isError: allowance.isError }),
    allowance: allowance.data,
    price: price.data,
    covers: coversPrice(allowance.data, price.data),
    refetch: allowance.refetch,
  }
}
