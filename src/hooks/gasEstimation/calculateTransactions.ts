import { Address, parseEther } from 'viem'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { Terms } from '@app/utils/snrcNameTerms'

import { useEstimateGasWithStateOverride } from '../chain/useEstimateGasWithStateOverride'

type ReturnType = null | Parameters<typeof useEstimateGasWithStateOverride>[0]['transactions']

const ACCEPTED_TERMS_SLOT = 2

export const calculateTransactions = ({
  registrationParams,
  terms,
  ethRegistrarControllerAddress,
  namePolicyAddress,
  fiveMinutesAgoInSeconds,
  price,
}: {
  registrationParams?: RegistrationParameters
  terms?: Terms
  ethRegistrarControllerAddress: unknown
  namePolicyAddress?: Address
  fiveMinutesAgoInSeconds: number
  price?: { base: bigint; premium: bigint }
}): ReturnType => {
  if (!registrationParams || !ethRegistrarControllerAddress || !price) return null
  const commitment = makeCommitment(registrationParams)

  const registrationStateOverride = {
    address: ethRegistrarControllerAddress as Address,
    stateDiff: [
      {
        slot: 160,
        keys: [commitment],
        value: BigInt(fiveMinutesAgoInSeconds),
      },
    ],
  }
  const termsStateOverride =
    terms && namePolicyAddress
      ? [
          {
            address: namePolicyAddress,
            stateDiff: [
              {
                slot: ACCEPTED_TERMS_SLOT,
                keys: [commitment, registrationParams.owner],
                value: terms.hash,
              },
            ],
          },
        ]
      : []

  return [
    {
      name: 'commitName',
      data: { ...registrationParams, terms },
    },
    {
      name: 'registerName',
      data: registrationParams,
      stateOverride: [
        registrationStateOverride,
        ...termsStateOverride,
        {
          address: registrationParams.owner,
          balance: price ? (price.base + price.premium) * 2n + parseEther('1000000') : undefined,
        },
      ],
    },
  ] as const
}
