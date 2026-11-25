import type { TFunction } from 'react-i18next'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'
import { commitName } from '@ensdomains/ensjs/wallet'

import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { SignedIntent } from '@app/utils/snrcIntents'
import { Terms } from '@app/utils/snrcNameTerms'

import acceptTerms from './acceptTerms'

type Data = RegistrationParameters & { name: string; terms?: Terms; termsIntent?: SignedIntent }

const displayItems = (
  { name, terms }: Data,
  t: TFunction<'translation', undefined>,
): TransactionDisplayItem[] => [
  {
    label: 'name',
    value: name,
    type: 'name',
  },
  {
    label: 'action',
    value: t('transaction.description.commitName'),
  },
  ...(terms ? [{ label: 'action', value: t('transaction.description.acceptTerms') }] : []),
  {
    label: 'info',
    value: t('transaction.info.commitName'),
  },
]

const transaction = async ({
  client,
  connectorClient,
  data: { terms, termsIntent, ...data },
}: TransactionFunctionParameters<Data>) => {
  if (!terms) return commitName.makeFunctionData(connectorClient, data)
  return acceptTerms.transaction({
    client,
    connectorClient,
    data: { name: data.name, commitment: makeCommitment(data), terms, intent: termsIntent },
  })
}

export default { displayItems, transaction } satisfies Transaction<Data>
