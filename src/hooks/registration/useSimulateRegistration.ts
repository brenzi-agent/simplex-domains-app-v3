import { Address } from 'viem'
import { usePublicClient, useSimulateContract, UseSimulateContractParameters } from 'wagmi'

import { ethRegistrarControllerRegisterSnippet } from '@ensdomains/ensjs/contracts'
import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { Credit, makeRegisterWithCreditCall } from '@app/utils/snrcSponsor'
import { calculateValueWithBuffer } from '@app/utils/utils'

import { usePrice } from '../ensjs/public/usePrice'

type UseSimulateRegistrationParameters = Pick<UseSimulateContractParameters, 'query'> & {
  registrationParams: RegistrationParameters
  credit?: Credit
}

type UseSimulateEthRegistrarControllerRegisterReturnType = UseSimulateContractParameters<
  typeof ethRegistrarControllerRegisterSnippet,
  'register'
>

export const makeSimulateRegistrationParams = ({
  registrationParams,
  ensEthRegistrarControllerAddress,
}: {
  registrationParams: RegistrationParameters
  ensEthRegistrarControllerAddress: Address
}): UseSimulateEthRegistrarControllerRegisterReturnType => {
  return {
    abi: ethRegistrarControllerRegisterSnippet,
    address: ensEthRegistrarControllerAddress,
    functionName: 'register',
    args: [makeRegistrationCallData(registrationParams)],
  }
}

export const useSimulateRegistration = ({
  registrationParams,
  credit,
  query,
}: UseSimulateRegistrationParameters) => {
  const client = usePublicClient()

  const { data: price } = usePrice({
    nameOrNames: registrationParams.name,
    duration: registrationParams.duration,
  })

  const base = price?.base ?? 0n
  const premium = price?.premium ?? 0n
  const value = base + premium
  const enabled = query?.enabled ?? true

  const paidSimulation = useSimulateContract({
    ...makeSimulateRegistrationParams({
      registrationParams,
      ensEthRegistrarControllerAddress: client.chain.contracts.ensEthRegistrarController.address,
    }),
    value: calculateValueWithBuffer(value),
    // Only simulate once the price has loaded. Otherwise a transient price-fetch
    // failure on a slow connection makes `value` fall back to 0n, the register
    // simulation reverts (InsufficientValue), and the retry loop keeps re-simulating
    // with the stale 0n forever — leaving the register step stuck with no recovery.
    query: {
      ...query,
      enabled: enabled && !credit && !!price,
    },
  })

  const creditSimulation = useSimulateContract({
    ...makeRegisterWithCreditCall({ chainId: client.chain.id, registrationParams }),
    query: { ...query, enabled: enabled && !!credit },
  })

  return credit ? creditSimulation : paidSimulation
}
