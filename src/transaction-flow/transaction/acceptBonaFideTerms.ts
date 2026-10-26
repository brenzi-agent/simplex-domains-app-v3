import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData, Hex } from 'viem'
import { readContract } from 'viem/actions'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

type Data = { name: string; termsHash: Hex } & ({ commitment: Hex } | { holder: Address })

const displayItems = (
  { name }: Data,
  t: TFunction<'translation', undefined>,
): TransactionDisplayItem[] => [
  {
    label: 'name',
    value: name,
    type: 'name',
  },
  {
    label: 'action',
    value: t('transaction.description.acceptBonaFideTerms'),
  },
]

const transaction = async ({ client, data }: TransactionFunctionParameters<Data>) => {
  const addresses = getSnrcAddresses(client.chain.id)
  const to = addresses.SimplexNamePolicy as Address
  if ('commitment' in data)
    return {
      to,
      data: encodeFunctionData({
        abi: namePolicyBonaFideAbi,
        functionName: 'commitUnderBonaFideCommunityTerms',
        args: [data.commitment, data.termsHash],
      }),
    }
  const tokenId = getSnrcTokenId(data.name)!
  const offer = await readContract(client, {
    address: addresses.BaseRegistrarImplementation as Address,
    abi: registrarOfferAbi,
    functionName: 'offers',
    args: [tokenId],
  })
  return {
    to,
    data: encodeFunctionData({
      abi: namePolicyBonaFideAbi,
      functionName: 'acceptBonaFideCommunityTermsForClaim',
      args: [tokenId, data.holder, offer, data.termsHash],
    }),
  }
}

export default { displayItems, transaction } satisfies Transaction<Data>
