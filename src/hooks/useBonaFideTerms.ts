import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'
import { Address, Hex, labelhash, zeroAddress } from 'viem'
import { readContract } from 'viem/actions'

import { getSnrcAddresses } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { bonaFideTermsQueryOptions, namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

import { useQueryOptions } from './useQueryOptions'

const getNamePolicy = (chainId: number) => {
  const namePolicy = getSnrcAddresses(chainId).SimplexNamePolicy as Address | undefined
  return namePolicy && namePolicy !== zeroAddress ? namePolicy : undefined
}

type BonaFideListingQueryKey = CreateQueryKey<{ name: string }, 'getBonaFideListing', 'standard'>

export const getBonaFideListingQueryFn =
  (config: ConfigWithEns) =>
  async ({ queryKey: [{ name }, chainId] }: QueryFunctionContext<BonaFideListingQueryKey>) => {
    const namePolicy = getNamePolicy(chainId)
    const labels = name.split('.')
    if (!namePolicy || labels.length !== 2) return null
    const client = config.getClient({ chainId })
    const [isListed, termsHash] = await Promise.all([
      readContract(client, {
        address: namePolicy,
        abi: namePolicyBonaFideAbi,
        functionName: 'bonaFideNames',
        args: [labelhash(labels[0])],
      }),
      readContract(client, {
        address: namePolicy,
        abi: namePolicyBonaFideAbi,
        functionName: 'termsHash',
      }),
    ])
    return { isListed, termsHash }
  }

export const useBonaFideTerms = ({ name }: { name?: string }) => {
  const initialOptions = useQueryOptions({
    params: { name: name ?? '' },
    functionName: 'getBonaFideListing',
    queryDependencyType: 'standard',
    queryFn: getBonaFideListingQueryFn,
  })
  const listing = useQuery(
    queryOptions({
      queryKey: initialOptions.queryKey,
      queryFn: initialOptions.queryFn,
      enabled: !!name,
    }),
  )
  const isListed = !!listing.data?.isListed
  const termsHash = listing.data?.termsHash
  const terms = useQuery({
    ...bonaFideTermsQueryOptions(name?.split('.')[1] ?? ''),
    enabled: isListed,
  })

  return {
    isListed,
    termsHash,
    text: terms.data?.text,
    matches: !!termsHash && terms.data?.hash === termsHash,
    isLoading: listing.isLoading || (isListed && terms.isLoading),
    isFetching: listing.isFetching,
  }
}

type CommittedTermsQueryKey = CreateQueryKey<{ commitment: Hex }, 'getCommittedTerms', 'standard'>

export const getCommittedTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({
    queryKey: [{ commitment }, chainId, acceptor],
  }: QueryFunctionContext<CommittedTermsQueryKey>) => {
    const namePolicy = getNamePolicy(chainId)
    if (!namePolicy || !acceptor) return null
    return readContract(config.getClient({ chainId }), {
      address: namePolicy,
      abi: namePolicyBonaFideAbi,
      functionName: 'acceptedTerms',
      args: [commitment, acceptor],
    })
  }

export const useCommittedTerms = ({
  commitment,
  enabled,
}: {
  commitment: Hex
  enabled: boolean
}) => {
  const initialOptions = useQueryOptions({
    params: { commitment },
    functionName: 'getCommittedTerms',
    queryDependencyType: 'standard',
    queryFn: getCommittedTermsQueryFn,
  })
  return useQuery(
    queryOptions({ queryKey: initialOptions.queryKey, queryFn: initialOptions.queryFn, enabled }),
  )
}

type AcceptedClaimTermsQueryKey = CreateQueryKey<
  { name: string; holder?: Address },
  'getAcceptedClaimTerms',
  'standard'
>

export const getAcceptedClaimTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({
    queryKey: [{ name, holder }, chainId, recipient],
  }: QueryFunctionContext<AcceptedClaimTermsQueryKey>) => {
    const tokenId = getSnrcTokenId(name)
    if (tokenId === undefined || !holder || !recipient) return null
    const addresses = getSnrcAddresses(chainId)
    const client = config.getClient({ chainId })
    const offer = await readContract(client, {
      address: addresses.BaseRegistrarImplementation as Address,
      abi: registrarOfferAbi,
      functionName: 'offers',
      args: [tokenId],
    })
    return readContract(client, {
      address: addresses.SimplexNamePolicy as Address,
      abi: namePolicyBonaFideAbi,
      functionName: 'acceptedClaimTerms',
      args: [tokenId, holder, recipient, offer],
    })
  }

export const useAcceptedClaimTerms = ({
  name,
  holder,
  enabled,
}: {
  name: string
  holder?: Address
  enabled: boolean
}) => {
  const initialOptions = useQueryOptions({
    params: { name, holder },
    functionName: 'getAcceptedClaimTerms',
    queryDependencyType: 'standard',
    queryFn: getAcceptedClaimTermsQueryFn,
  })
  return useQuery(
    queryOptions({ queryKey: initialOptions.queryKey, queryFn: initialOptions.queryFn, enabled }),
  )
}
