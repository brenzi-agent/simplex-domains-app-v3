import type { TFunction } from 'react-i18next'
import { Hex } from 'viem'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'
import { commitName } from '@ensdomains/ensjs/wallet'

import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'

import acceptCommunityTerms from './acceptCommunityTerms'

type Data = RegistrationParameters & { name: string; communityTermsHash?: Hex }

const displayItems = (
  { name, communityTermsHash }: Data,
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
  ...(communityTermsHash
    ? [{ label: 'action', value: t('transaction.description.acceptCommunityTerms') }]
    : []),
  {
    label: 'info',
    value: t('transaction.info.commitName'),
  },
]

const transaction = async ({
  client,
  connectorClient,
  data: { communityTermsHash, ...data },
}: TransactionFunctionParameters<Data>) => {
  if (!communityTermsHash) return commitName.makeFunctionData(connectorClient, data)
  return acceptCommunityTerms.transaction({
    client,
    connectorClient,
    data: { name: data.name, commitment: makeCommitment(data), termsHash: communityTermsHash },
  })
}

export default { displayItems, transaction } satisfies Transaction<Data>
