import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData, Hex } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
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
  to: getSnrcAddresses(client.chain.id).SimplexNamePolicy as Address,
  data: encodeFunctionData({
    abi: namePolicyBonaFideAbi,
    functionName: 'commitUnderBonaFideCommunityTerms',
    args: [data.commitment, data.termsHash],
  }),
})

export default { displayItems, transaction } satisfies Transaction<Data>
