import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'
import { Address, Hex, toHex } from 'viem'
import { readContract } from 'viem/actions'

import { getNamePolicyAddress } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'
import { getSnrcTokenId } from '@app/utils/snrcOffers'

import { useQueryOptions } from './useQueryOptions'

type ListedTermsQueryKey = CreateQueryKey<{ name: string }, 'getListedTerms', 'standard'>

export const getListedTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({ queryKey: [{ name }, chainId] }: QueryFunctionContext<ListedTermsQueryKey>) => {
    const namePolicyAddress = getNamePolicyAddress(chainId)
    const tokenId = getSnrcTokenId(name)
    if (!namePolicyAddress || tokenId === undefined) return null
    const client = config.getClient({ chainId })
    const [isListed, termsHash, text] = await Promise.all([
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
      readContract(client, {
        address: namePolicyAddress,
        abi: namePolicyBonaFideAbi,
        functionName: 'termsText',
      }),
    ])
    return isListed ? { termsHash, text } : null
  }

export const useBonaFideTerms = ({ name }: { name: string }) => {
  const initialOptions = useQueryOptions({
    params: { name },
    functionName: 'getListedTerms',
    queryDependencyType: 'standard',
    queryFn: getListedTermsQueryFn,
  })
  const listing = useQuery(
    queryOptions({ queryKey: initialOptions.queryKey, queryFn: initialOptions.queryFn }),
  )

  return {
    isListed: !!listing.data,
    termsHash: listing.data?.termsHash,
    text: listing.data?.text,
    // the name policy keeps the text whose keccak256 is termsHash; it is empty until the first setTerms
    hasTerms: !!listing.data?.text,
    isLoading: listing.isLoading,
    isFetching: listing.isFetching,
  }
}

type CommittedTermsQueryKey = CreateQueryKey<{ commitment: Hex }, 'getCommittedTerms', 'standard'>

export const getCommittedTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({
    queryKey: [{ commitment }, chainId, acceptor],
  }: QueryFunctionContext<CommittedTermsQueryKey>) => {
    const namePolicyAddress = getNamePolicyAddress(chainId)
    if (!namePolicyAddress || !acceptor) return null
    return readContract(config.getClient({ chainId }), {
      address: namePolicyAddress,
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
    const namePolicyAddress = getNamePolicyAddress(chainId)
    const tokenId = getSnrcTokenId(name)
    if (
      !namePolicyAddress ||
      tokenId === undefined ||
      !holder ||
      offerNumber === undefined ||
      !recipient
    )
      return null
    return readContract(config.getClient({ chainId }), {
      address: namePolicyAddress,
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
