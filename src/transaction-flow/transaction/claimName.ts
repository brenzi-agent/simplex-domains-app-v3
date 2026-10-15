import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

type Data = {
  name: string
  holder: Address
}

const displayItems = (
  { name, holder }: Data,
  t: TFunction<'translation', undefined>,
): TransactionDisplayItem[] => [
  {
    label: 'name',
    value: name,
    type: 'name',
  },
  {
    label: 'action',
    value: t('transaction.description.claimName'),
  },
  {
    label: 'address',
    value: holder,
    type: 'address',
  },
]

const transaction = ({ client, connectorClient, data }: TransactionFunctionParameters<Data>) => ({
  to: getSnrcAddresses(client.chain.id).BaseRegistrarImplementation as Address,
  data: encodeFunctionData({
    abi: registrarOfferAbi,
    functionName: 'transferFrom',
    args: [data.holder, connectorClient.account.address, getSnrcTokenId(data.name)!],
  }),
})

export default { displayItems, transaction } satisfies Transaction<Data>
