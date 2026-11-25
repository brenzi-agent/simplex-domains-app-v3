import type { TFunction } from 'react-i18next'
import { Address, zeroAddress } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { SignedIntent } from '@app/utils/snrcIntents'
import { encodeApproveName } from '@app/utils/snrcOffers'

type Data = {
  name: string
  intent?: SignedIntent
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
  data: encodeApproveName({ name: data.name, to: zeroAddress, intent: data.intent }),
})

export default { displayItems, transaction } satisfies Transaction<Data>
