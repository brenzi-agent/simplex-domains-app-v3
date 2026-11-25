import type { TFunction } from 'react-i18next'
import { Address } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { SignedIntent } from '@app/utils/snrcIntents'
import { encodeApproveName } from '@app/utils/snrcOffers'

type Data = {
  name: string
  recipient: Address
  intent?: SignedIntent
}

const displayItems = (
  { name, recipient }: Data,
  t: TFunction<'translation', undefined>,
): TransactionDisplayItem[] => [
  {
    label: 'name',
    value: name,
    type: 'name',
  },
  {
    label: 'action',
    value: t('transaction.description.offerName'),
  },
  {
    label: 'to',
    value: recipient,
    type: 'address',
  },
  {
    label: 'info',
    value: t('transaction.info.offerName'),
  },
]

const transaction = ({ client, data }: TransactionFunctionParameters<Data>) => ({
  to: getSnrcAddresses(client.chain.id).BaseRegistrarImplementation as Address,
  data: encodeApproveName({ name: data.name, to: data.recipient, intent: data.intent }),
})

export default { displayItems, transaction, backToInput: true } satisfies Transaction<Data>
