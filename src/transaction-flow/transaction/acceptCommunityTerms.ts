import type { TFunction } from 'react-i18next'
import { encodeFunctionData, Hex } from 'viem'

import { getNamePolicyAddress } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'

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
    value: t('transaction.description.acceptCommunityTerms'),
  },
]

const transaction = ({ client, data }: TransactionFunctionParameters<Data>) => ({
  to: getNamePolicyAddress(client.chain.id)!,
  data: encodeFunctionData({
    abi: namePolicyCommunityAbi,
    functionName: 'commitUnderCommunityTerms',
    args: [data.commitment, data.termsHash],
  }),
})

export default { displayItems, transaction } satisfies Transaction<Data>
