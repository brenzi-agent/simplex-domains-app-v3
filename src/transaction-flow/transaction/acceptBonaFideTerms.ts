import type { TFunction } from 'react-i18next'
import { encodeFunctionData, Hex } from 'viem'

import { getNamePolicyAddress } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

type Data = { name: string; commitment: Hex; termsHash: Hex }

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

const transaction = async ({ client, data }: TransactionFunctionParameters<Data>) => ({
  to: getNamePolicyAddress(client.chain.id)!,
  data: encodeFunctionData({
    abi: namePolicyBonaFideAbi,
    functionName: 'commitUnderBonaFideCommunityTerms',
    args: [data.commitment, data.termsHash],
  }),
})

export default { displayItems, transaction } satisfies Transaction<Data>
