import type { TFunction } from 'react-i18next'
import { Address, encodeFunctionData, Hex } from 'viem'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'
import { commitName } from '@ensdomains/ensjs/wallet'

import { getSnrcAddresses } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { namePolicyBonaFideAbi } from '@app/utils/snrcBonaFide'

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
  return {
    to: getSnrcAddresses(client.chain.id).SimplexNamePolicy as Address,
    data: encodeFunctionData({
      abi: namePolicyBonaFideAbi,
      functionName: 'commitUnderBonaFideCommunityTerms',
      args: [makeCommitment(data), bonaFideTermsHash],
    }),
  }
}

export default { displayItems, transaction } satisfies Transaction<Data>
