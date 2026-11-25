import type { TFunction } from 'react-i18next'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'
import { commitName } from '@ensdomains/ensjs/wallet'

import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { Terms } from '@app/utils/snrcNameTerms'
import { SignedCredit } from '@app/utils/snrcSponsor'

import acceptTerms from './acceptTerms'

type Data = RegistrationParameters & { name: string; terms?: Terms; credit?: SignedCredit }

const displayItems = (
  { name, owner, terms, credit }: Data,
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
  ...(credit ? [{ label: 'owner', value: owner, type: 'address' } as const] : []),
  {
    label: 'info',
    value: t('transaction.info.commitName'),
  },
]

const transaction = async ({
  client,
  connectorClient,
  data: { terms, credit, ...data },
}: TransactionFunctionParameters<Data>) => {
  const accepted = credit ? credit.intents.terms : terms
  if (!accepted) return commitName.makeFunctionData(connectorClient, data)
  return acceptTerms.transaction({
    client,
    connectorClient,
    data: {
      name: data.name,
      commitment: makeCommitment(data),
      terms: accepted,
      intent: credit?.intents.terms && { ...credit.intents.terms.intent, signer: data.owner },
    },
  })
}

export default { displayItems, transaction } satisfies Transaction<Data>
