import type { TFunction } from 'react-i18next'
import { encodeFunctionData, Hex } from 'viem'

import { getNamePolicyAddress } from '@app/constants/chains'
import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { SignedIntent } from '@app/utils/snrcIntents'
import { namePolicyTermsAbi, Terms } from '@app/utils/snrcNameTerms'

type Data = { name: string; commitment: Hex; terms: Terms; intent?: SignedIntent }

const displayItems = (
  { name, intent }: Data,
  t: TFunction<'translation', undefined>,
): TransactionDisplayItem[] => [
  {
    label: 'name',
    value: name,
    type: 'name',
  },
  {
    label: 'action',
    value: t('transaction.description.acceptTerms'),
  },
  ...(intent ? [{ label: 'owner', value: intent.signer, type: 'address' } as const] : []),
]

const commitUnderTerms = {
  general: { direct: 'commitUnderGeneralTerms', withSig: 'commitUnderGeneralTermsWithSig' },
  community: { direct: 'commitUnderCommunityTerms', withSig: 'commitUnderCommunityTermsWithSig' },
} as const

const transaction = ({
  client,
  data: { commitment, terms, intent },
}: TransactionFunctionParameters<Data>) => {
  const functionNames = commitUnderTerms[terms.kind]
  return {
    to: getNamePolicyAddress(client.chain.id)!,
    data: intent
      ? encodeFunctionData({
          abi: namePolicyTermsAbi,
          functionName: functionNames.withSig,
          args: [
            commitment,
            terms.hash,
            intent.signer,
            intent.nonce,
            intent.deadline,
            intent.signature,
          ],
        })
      : encodeFunctionData({
          abi: namePolicyTermsAbi,
          functionName: functionNames.direct,
          args: [commitment, terms.hash],
        }),
  }
}

export default { displayItems, transaction } satisfies Transaction<Data>
