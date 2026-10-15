import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'
import { Address, zeroAddress } from 'viem'
import { readContract } from 'viem/actions'

import { getSnrcAddresses } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

import { useQueryOptions } from './useQueryOptions'

type UseNameOfferParameters = {
  name?: string
}

type QueryKey = CreateQueryKey<UseNameOfferParameters, 'getNameOffer', 'standard'>

export type NameOffer = {
  tokenId: bigint
  holder: Address
  /** Who the holder offered the name to; undefined when nothing is offered. */
  recipient: Address | undefined
  offer: bigint
}

const getNameOfferQueryFn =
  (config: ConfigWithEns) =>
  async ({ queryKey: [{ name }, chainId] }: QueryFunctionContext<QueryKey>) => {
    const tokenId = getSnrcTokenId(name)
    const registrar = getSnrcAddresses(chainId).BaseRegistrarImplementation as Address | undefined
    if (tokenId === undefined || !registrar || registrar === zeroAddress) return null

    const client = config.getClient({ chainId })
    const target = { address: registrar, abi: registrarOfferAbi, args: [tokenId] } as const

    // `ownerOf` reverts for an unregistered or lapsed name, which has no offer.
    const holder = await readContract(client, { ...target, functionName: 'ownerOf' }).catch(
      () => undefined,
    )
    if (!holder) return null
    const [approved, offer] = await Promise.all([
      readContract(client, { ...target, functionName: 'getApproved' }),
      readContract(client, { ...target, functionName: 'offers' }),
    ])
    return {
      tokenId,
      holder,
      recipient: approved === zeroAddress ? undefined : approved,
      offer,
    } satisfies NameOffer
  }

/** The holder of an SNRC 2LD and whom, if anyone, they have offered it to. */
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

  return useQuery({
    ...preparedOptions,
    enabled: getSnrcTokenId(name) !== undefined,
  })
}
