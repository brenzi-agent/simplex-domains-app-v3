import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'
import { Address, namehash, zeroAddress } from 'viem'
import { readContract } from 'viem/actions'

import { getSnrcAddresses } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { getSnrcTokenId, readOwnerOf, registrarOfferAbi } from '@app/utils/snrcOffers'

import { useAccountSafely } from './account/useAccountSafely'
import { useQueryOptions } from './useQueryOptions'
import { useAccountAllowance } from './useRegistrarAllowance'

type UseNameOfferParameters = {
  name: string
}

type QueryKey = CreateQueryKey<UseNameOfferParameters, 'getNameOffer', 'standard'>

export const getNameOfferQueryFn =
  (config: ConfigWithEns) =>
  async ({ queryKey: [{ name }, chainId, address] }: QueryFunctionContext<QueryKey>) => {
    const tokenId = getSnrcTokenId(name)
    const registrar = getSnrcAddresses(chainId).BaseRegistrarImplementation as Address | undefined
    if (tokenId === undefined || !registrar || registrar === zeroAddress) return null

    const client = config.getClient({ chainId })
    const target = { address: registrar, abi: registrarOfferAbi, args: [tokenId] } as const

    // `ownerOf` reverts for an unregistered or lapsed name, which has no holder.
    const holder = await readOwnerOf(client, registrar, tokenId)
    if (!holder) return null
    const [baseNode, approved, offerNumber] = await Promise.all([
      readContract(client, {
        address: registrar,
        abi: registrarOfferAbi,
        functionName: 'baseNode',
      }),
      readContract(client, { ...target, functionName: 'getApproved' }),
      readContract(client, { ...target, functionName: 'offers' }),
    ])
    if (baseNode !== namehash(name.split('.')[1])) return null
    const recipient = approved === zeroAddress ? undefined : approved
    return {
      holder,
      recipient,
      offerNumber,
      isHolder: !!address && holder.toLowerCase() === address.toLowerCase(),
      isRecipient: !!address && recipient?.toLowerCase() === address.toLowerCase(),
    }
  }

export const useNameOffer = ({ name }: UseNameOfferParameters) => {
  const initialOptions = useQueryOptions({
    params: { name },
    functionName: 'getNameOffer',
    queryDependencyType: 'standard',
    queryFn: getNameOfferQueryFn,
  })

  const preparedOptions = queryOptions({
    queryKey: initialOptions.queryKey,
    queryFn: initialOptions.queryFn,
  })

  return useQuery(preparedOptions)
}

export type ConnectedHolder = { kind: 'selected' } | { kind: 'relayed'; account: Address }

export const getConnectedHolder = ({
  offer,
  addresses,
  allowance,
}: {
  offer?: { holder: Address; isHolder: boolean } | null
  addresses?: readonly Address[]
  allowance?: bigint
}): ConnectedHolder | undefined => {
  if (!offer) return undefined
  if (offer.isHolder) return { kind: 'selected' }
  const holder = offer.holder.toLowerCase()
  const account = allowance
    ? addresses?.find((connected) => connected.toLowerCase() === holder)
    : undefined
  return account && { kind: 'relayed', account }
}

export const useConnectedHolder = ({ name }: UseNameOfferParameters) => {
  const offer = useNameOffer({ name })
  const { addresses } = useAccountSafely()
  const { allowance } = useAccountAllowance()
  const connectedHolder = getConnectedHolder({
    offer: offer.data,
    addresses,
    allowance: allowance.data,
  })
  return { offer, connectedHolder }
}
