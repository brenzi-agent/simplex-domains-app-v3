import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData, Hex } from 'viem'

import { getNamePolicyAddress } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'
import { getSnrcTokenId } from '@app/utils/snrcOffers'

type Data = { name: string; holder: Address; offerNumber: bigint; termsHash: Hex }

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
    value: t('transaction.description.acceptCommunityClaimTerms'),
  },
]

const transaction = ({ client, data }: TransactionFunctionParameters<Data>) => ({
  to: getNamePolicyAddress(client.chain.id)!,
  data: encodeFunctionData({
    abi: namePolicyCommunityAbi,
    functionName: 'acceptCommunityTermsForClaim',
    args: [getSnrcTokenId(data.name)!, data.holder, data.offerNumber, data.termsHash],
  }),
})

export default { displayItems, transaction, backToInput: true } satisfies Transaction<Data>
