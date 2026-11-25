import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData } from 'viem'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { NO_ANNOUNCEMENT, SignedIntent } from '@app/utils/snrcIntents'
import { getSnrcTokenId, registrarOfferAbi } from '@app/utils/snrcOffers'

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
  data: data.intent
    ? encodeFunctionData({
        abi: registrarOfferAbi,
        functionName: 'approveWithSig',
        args: [
          data.intent.signer,
          data.recipient,
          getSnrcTokenId(data.name)!,
          data.intent.nonce,
          data.intent.deadline,
          data.intent.signature,
          NO_ANNOUNCEMENT.ephemeralPubKey,
          NO_ANNOUNCEMENT.viewTag,
        ],
      })
    : encodeFunctionData({
        abi: registrarOfferAbi,
        functionName: 'approve',
        args: [data.recipient, getSnrcTokenId(data.name)!],
      }),
})

export default { displayItems, transaction, backToInput: true } satisfies Transaction<Data>
