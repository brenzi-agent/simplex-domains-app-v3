import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData, Hex } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { getClaimChecks } from '@app/utils/snrcClaimChecks'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

type Data = {
  name: string
  holder: Address
  digest: Hex
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
    label: 'from',
    value: holder,
    type: 'address',
  },
]

const transaction = async ({
  client,
  connectorClient,
  data,
}: TransactionFunctionParameters<Data>) => {
  const { digest } = await getClaimChecks(client, data.name)
  if (digest !== data.digest)
    throw new Error('The name changed after you reviewed it. Go back to review it again.')
  return {
    to: getSnrcAddresses(client.chain.id).BaseRegistrarImplementation as Address,
    data: encodeFunctionData({
      abi: registrarOfferAbi,
      functionName: 'transferFrom',
      args: [data.holder, connectorClient.account.address, getSnrcTokenId(data.name)!],
    }),
  }
}

export default { displayItems, transaction, backToInput: true } satisfies Transaction<Data>
