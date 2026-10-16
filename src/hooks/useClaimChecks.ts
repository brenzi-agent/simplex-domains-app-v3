import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'

import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { getClaimChecks } from '@app/utils/snrcClaimChecks'

import { useQueryOptions } from './useQueryOptions'

type UseClaimChecksParameters = {
  name: string
}

type QueryKey = CreateQueryKey<UseClaimChecksParameters, 'getClaimChecks', 'standard'>

const getClaimChecksQueryFn =
  (config: ConfigWithEns) =>
  ({ queryKey: [{ name }, chainId] }: QueryFunctionContext<QueryKey>) =>
    getClaimChecks(config.getClient({ chainId }), name)

export const useClaimChecks = ({ name }: UseClaimChecksParameters) => {
  const initialOptions = useQueryOptions({
    params: { name },
    functionName: 'getClaimChecks',
    queryDependencyType: 'standard',
    queryFn: getClaimChecksQueryFn,
  })

  const preparedOptions = queryOptions({
    queryKey: initialOptions.queryKey,
    queryFn: initialOptions.queryFn,
    gcTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return useQuery(preparedOptions)
}
