import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'
import { Address, Hex, toHex } from 'viem'
import { readContract } from 'viem/actions'

import { getNamePolicyAddress } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { bonaFideTermsQueryOptions, namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'
import { getSnrcTokenId } from '@app/utils/snrcOffers'
import { getTldFromName } from '@app/utils/utils'

import { useQueryOptions } from './useQueryOptions'

type ListedTermsHashQueryKey = CreateQueryKey<{ name: string }, 'getListedTermsHash', 'standard'>

export const getListedTermsHashQueryFn =
  (config: ConfigWithEns) =>
  async ({ queryKey: [{ name }, chainId] }: QueryFunctionContext<ListedTermsHashQueryKey>) => {
    const namePolicyAddress = getNamePolicyAddress(chainId)
    const tokenId = getSnrcTokenId(name)
    if (!namePolicyAddress || tokenId === undefined) return null
    const client = config.getClient({ chainId })
    const [isListed, termsHash] = await Promise.all([
      readContract(client, {
        address: namePolicyAddress,
        abi: namePolicyBonaFideAbi,
        functionName: 'bonaFideNames',
        args: [toHex(tokenId, { size: 32 })],
      }),
      readContract(client, {
        address: namePolicyAddress,
        abi: namePolicyBonaFideAbi,
        functionName: 'termsHash',
      }),
    ])
    return isListed ? termsHash : null
  }

export const useBonaFideTerms = ({ name }: { name: string }) => {
  const initialOptions = useQueryOptions({
    params: { name },
    functionName: 'getListedTermsHash',
    queryDependencyType: 'standard',
    queryFn: getListedTermsHashQueryFn,
  })
  const listing = useQuery(
    queryOptions({ queryKey: initialOptions.queryKey, queryFn: initialOptions.queryFn }),
  )
  const termsHash = listing.data ?? undefined
  const isListed = !!termsHash
  const terms = useQuery({ ...bonaFideTermsQueryOptions(getTldFromName(name)!), enabled: isListed })

  return {
    isListed,
    termsHash,
    text: terms.data?.text,
    matches: isListed && terms.data?.hash === termsHash,
    isLoading: listing.isLoading || terms.isLoading,
    isFetching: listing.isFetching,
  }
}

type CommittedTermsQueryKey = CreateQueryKey<{ commitment: Hex }, 'getCommittedTerms', 'standard'>

export const getCommittedTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({
    queryKey: [{ commitment }, chainId, acceptor],
  }: QueryFunctionContext<CommittedTermsQueryKey>) => {
    if (!acceptor) return null
    return readContract(config.getClient({ chainId }), {
      address: getNamePolicyAddress(chainId)!,
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
  { name: string; holder?: Address; offerNumber?: bigint },
  'getAcceptedClaimTerms',
  'standard'
>

export const getAcceptedClaimTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({
    queryKey: [{ name, holder, offerNumber }, chainId, recipient],
  }: QueryFunctionContext<AcceptedClaimTermsQueryKey>) => {
    const tokenId = getSnrcTokenId(name)
    if (tokenId === undefined || !holder || offerNumber === undefined || !recipient) return null
    return readContract(config.getClient({ chainId }), {
      address: getNamePolicyAddress(chainId)!,
      abi: namePolicyBonaFideAbi,
      functionName: 'acceptedClaimTerms',
      args: [tokenId, holder, recipient, offerNumber],
    })
  }

export const useAcceptedClaimTerms = ({
  name,
  holder,
  offerNumber,
  enabled,
}: {
  name: string
  holder?: Address
  offerNumber?: bigint
  enabled: boolean
}) => {
  const initialOptions = useQueryOptions({
    params: { name, holder, offerNumber },
    functionName: 'getAcceptedClaimTerms',
    queryDependencyType: 'standard',
    queryFn: getAcceptedClaimTermsQueryFn,
  })
  return useQuery(
    queryOptions({ queryKey: initialOptions.queryKey, queryFn: initialOptions.queryFn, enabled }),
  )
}
