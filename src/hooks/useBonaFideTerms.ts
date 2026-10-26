import {
  QueryFunctionContext,
  queryOptions,
  useQuery as useTanstackQuery,
} from '@tanstack/react-query'
import { Address, Hex, labelhash, zeroAddress } from 'viem'
import { readContract } from 'viem/actions'
import { useChainId, useReadContract, useReadContracts } from 'wagmi'

import { getSnrcAddresses } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import {
  fetchBonaFideTerms,
  getBonaFideTermsPath,
  namePolicyBonaFideAbi,
} from '@app/utils/snrcBonaFide'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

import { useQueryOptions } from './useQueryOptions'

export const useNamePolicyAddress = () => {
  const namePolicy = getSnrcAddresses(useChainId()).SimplexNamePolicy as Address | undefined
  return namePolicy && namePolicy !== zeroAddress ? namePolicy : undefined
}

export const useBonaFideTerms = ({ name }: { name?: string }) => {
  const namePolicy = useNamePolicyAddress()
  const labels = name?.split('.') ?? []
  const enabled = !!namePolicy && labels.length === 2 && !!labels[0]

  const { data, isFetching, refetch } = useReadContracts({
    contracts: [
      {
        address: namePolicy,
        abi: namePolicyBonaFideAbi,
        functionName: 'bonaFideNames',
        args: [labelhash(labels[0] ?? '')],
      },
      { address: namePolicy, abi: namePolicyBonaFideAbi, functionName: 'termsHash' },
    ],
    allowFailure: false,
    query: { enabled, staleTime: 30_000 },
  })
  const [isListed = false, termsHash] = data ?? []

  const path = getBonaFideTermsPath(labels[1] ?? '')
  const terms = useTanstackQuery({
    queryKey: ['bonaFideTerms', path],
    queryFn: () => fetchBonaFideTerms(path),
    enabled: isListed,
    staleTime: Infinity,
  })

  return {
    isListed,
    termsHash,
    text: terms.data?.text,
    matches: !!termsHash && terms.data?.hash === termsHash,
    isLoading: enabled && (isFetching || (isListed && terms.isLoading)),
    refetch: enabled ? refetch : undefined,
  }
}

export const useAcceptedTerms = ({
  commitment,
  acceptor,
  enabled,
}: {
  commitment: Hex
  acceptor?: Address
  enabled: boolean
}) => {
  const namePolicy = useNamePolicyAddress()
  return useReadContract({
    address: namePolicy,
    abi: namePolicyBonaFideAbi,
    functionName: 'acceptedTerms',
    args: [commitment, acceptor!],
    query: { enabled: enabled && !!namePolicy && !!acceptor },
  })
}

type UseAcceptedClaimTermsParameters = { name: string; holder?: Address }

type AcceptedClaimTermsQueryKey = CreateQueryKey<
  UseAcceptedClaimTermsParameters,
  'getAcceptedClaimTerms',
  'standard'
>

export const getAcceptedClaimTermsQueryFn =
  (config: ConfigWithEns) =>
  async ({
    queryKey: [{ name, holder }, chainId, recipient],
  }: QueryFunctionContext<AcceptedClaimTermsQueryKey>) => {
    const tokenId = getSnrcTokenId(name)
    const addresses = getSnrcAddresses(chainId)
    if (tokenId === undefined || !holder || !recipient) return null
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
}: UseAcceptedClaimTermsParameters & { enabled: boolean }) => {
  const initialOptions = useQueryOptions({
    params: { name, holder },
    functionName: 'getAcceptedClaimTerms',
    queryDependencyType: 'standard',
    queryFn: getAcceptedClaimTermsQueryFn,
  })

  const preparedOptions = queryOptions({
    queryKey: initialOptions.queryKey,
    queryFn: initialOptions.queryFn,
  })

  return useQuery({ ...preparedOptions, enabled: enabled && !!holder })
}
