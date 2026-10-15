import { QueryFunctionContext, queryOptions } from '@tanstack/react-query'
import {
  Address,
  encodePacked,
  Hex,
  keccak256,
  namehash,
  parseAbi,
  parseAbiItem,
  zeroAddress,
} from 'viem'
import { getLogs, readContract } from 'viem/actions'

import { getChainContractAddress } from '@ensdomains/ensjs/contracts'

import { getSnrcAddresses } from '@app/constants/chains'
import { ConfigWithEns, CreateQueryKey } from '@app/types'
import { useQuery } from '@app/utils/query/useQuery'
import { getSnrcSubnames } from '@app/utils/snrcSubnames'

import { useQueryOptions } from './useQueryOptions'

const registryAbi = parseAbi([
  'function owner(bytes32 node) view returns (address)',
  'function resolver(bytes32 node) view returns (address)',
])
const controllerAbi = parseAbi(['function defaultResolver() view returns (address)'])
const newOwnerEvent = parseAbiItem(
  'event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner)',
)

// Bounds the walk: a holder can create an arbitrarily deep or wide subtree.
const MAX_SUBNODES = 100

export type ClaimSubnode = {
  node: Hex
  /** Known only for subnames the SubnameRegistrar created directly under the name. */
  name?: string
  owner: Address
  resolver: Address
  /** Owned by the SubnameRegistrar, so it follows the name; otherwise a shadow subnode. */
  tracked: boolean
}

export type ClaimChecks = {
  resolver: Address
  isDefaultResolver: boolean
  subnodes: ClaimSubnode[]
  /** False when the registry's logs could not be read in full. */
  subnodesComplete: boolean
}

type UseClaimChecksParameters = {
  name?: string
}

type QueryKey = CreateQueryKey<UseClaimChecksParameters, 'getClaimChecks', 'standard'>

const getClaimChecksQueryFn =
  (config: ConfigWithEns) =>
  async ({ queryKey: [{ name }, chainId] }: QueryFunctionContext<QueryKey>) => {
    if (!name) throw new Error('name is required')
    const client = config.getClient({ chainId })
    const registry = getChainContractAddress({ client, contract: 'ensRegistry' })
    const { ETHRegistrarController, SubnameRegistrar } = getSnrcAddresses(chainId)
    const node = namehash(name)
    const readRegistry = (functionName: 'owner' | 'resolver', at: Hex) =>
      readContract(client, { address: registry, abi: registryAbi, functionName, args: [at] })

    const [resolver, defaultResolver, tracked] = await Promise.all([
      readRegistry('resolver', node),
      readContract(client, {
        address: ETHRegistrarController as Address,
        abi: controllerAbi,
        functionName: 'defaultResolver',
      }),
      getSnrcSubnames(client, chainId, name),
    ])
    const names = new Map(tracked.map((s) => [s.node, s.name]))

    // Every node ever created under the name, from the registry's NewOwner logs,
    // including the shadow subnodes the SubnameRegistrar does not track.
    const seen: Hex[] = []
    const queue: Hex[] = [node]
    let subnodesComplete = true
    while (queue.length > 0) {
      if (seen.length >= MAX_SUBNODES) {
        subnodesComplete = false
        break
      }
      const parent = queue.shift()!
      try {
        // eslint-disable-next-line no-await-in-loop
        const logs = await getLogs(client, {
          address: registry,
          event: newOwnerEvent,
          args: { node: parent },
          fromBlock: 'earliest',
        })
        for (const log of logs) {
          const child = keccak256(encodePacked(['bytes32', 'bytes32'], [parent, log.args.label!]))
          if (!seen.includes(child)) {
            seen.push(child)
            queue.push(child)
          }
        }
      } catch {
        subnodesComplete = false
        break
      }
    }

    const subnodes = await Promise.all(
      seen.map(async (child) => {
        const [owner, childResolver] = await Promise.all([
          readRegistry('owner', child),
          readRegistry('resolver', child),
        ])
        return {
          node: child,
          name: names.get(child),
          owner,
          resolver: childResolver,
          tracked: owner.toLowerCase() === String(SubnameRegistrar).toLowerCase(),
        }
      }),
    )

    return {
      resolver,
      isDefaultResolver: resolver.toLowerCase() === defaultResolver.toLowerCase(),
      // a node with neither an owner nor a resolver has been cleared
      subnodes: subnodes.filter((s) => s.owner !== zeroAddress || s.resolver !== zeroAddress),
      subnodesComplete,
    } satisfies ClaimChecks
  }

/**
 * What a recipient takes on by claiming a name: its registry resolver, and every
 * subnode under it, tracked or not. The design requires showing these before a
 * claim (docs/plans/recipient-consent.md §8).
 */
export const useClaimChecks = ({
  name,
  enabled = true,
}: UseClaimChecksParameters & { enabled?: boolean }) => {
  const initialOptions = useQueryOptions({
    params: { name },
    functionName: 'getClaimChecks',
    queryDependencyType: 'standard',
    queryFn: getClaimChecksQueryFn,
  })

  const preparedOptions = queryOptions({
    queryKey: initialOptions.queryKey,
    queryFn: initialOptions.queryFn,
  })

  return useQuery({
    ...preparedOptions,
    enabled: enabled && !!name,
  })
}
