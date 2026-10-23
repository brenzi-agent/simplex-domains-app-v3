import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData, zeroAddress } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

type Data = {
  name: string
}

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
    value: t('transaction.description.withdrawOffer'),
  },
]

const transaction = ({ client, data }: TransactionFunctionParameters<Data>) => ({
  to: getSnrcAddresses(client.chain.id).BaseRegistrarImplementation as Address,
  data: encodeFunctionData({
    abi: registrarOfferAbi,
    functionName: 'approve',
    args: [zeroAddress, getSnrcTokenId(data.name)!],
  }),
})

export default { displayItems, transaction } satisfies Transaction<Data>
