import type { TFunction } from 'react-i18next'
import { Hex } from 'viem'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'
import { commitName } from '@ensdomains/ensjs/wallet'

import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'

import acceptBonaFideTerms from './acceptBonaFideTerms'

type Data = RegistrationParameters & { name: string; bonaFideTermsHash?: Hex }

const displayItems = (
  { name, bonaFideTermsHash }: Data,
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
  ...(bonaFideTermsHash
    ? [{ label: 'action', value: t('transaction.description.acceptBonaFideTerms') }]
    : []),
  {
    label: 'info',
    value: t('transaction.info.commitName'),
  },
]

const transaction = async ({
  client,
  connectorClient,
  data: { bonaFideTermsHash, ...data },
}: TransactionFunctionParameters<Data>) => {
  if (!bonaFideTermsHash) return commitName.makeFunctionData(connectorClient, data)
  return acceptBonaFideTerms.transaction({
    client,
    connectorClient,
    data: { name: data.name, commitment: makeCommitment(data), termsHash: bonaFideTermsHash },
  })
}

export default { displayItems, transaction } satisfies Transaction<Data>
