import type { TFunction } from 'react-i18next'
import { encodeFunctionData } from 'viem'

import { getPrice } from '@ensdomains/ensjs/public'
import { RegistrationParameters } from '@ensdomains/ensjs/utils'
import { registerName } from '@ensdomains/ensjs/wallet'

import { Transaction, TransactionDisplayItem, TransactionFunctionParameters } from '@app/types'
import { Credit, makeRegisterWithCreditCall } from '@app/utils/snrcSponsor'
import { calculateValueWithBuffer, formatDurationOfDates } from '@app/utils/utils'

type Data = RegistrationParameters & { credit?: Credit }
const now = Math.floor(Date.now())
const displayItems = (
  { name, duration }: Data,
  t: TFunction<'translation', undefined>,
): TransactionDisplayItem[] => [
  {
    label: 'name',
    value: name,
    type: 'name',
  },
  {
    label: 'action',
    value: t('transaction.description.registerName'),
  },
  {
    label: 'duration',
    value: formatDurationOfDates({
      startDate: new Date(),
      endDate: new Date(now + duration * 1000),
      t,
    }),
  },
]

const transaction = async ({
  client,
  connectorClient,
  data: { credit, ...data },
}: TransactionFunctionParameters<Data>) => {
  if (credit) {
    const { address, ...call } = makeRegisterWithCreditCall({
      chainId: client.chain.id,
      registrationParams: data,
      intent: credit.intents?.register,
    })
    return { to: address, data: encodeFunctionData(call) }
  }
  const price = await getPrice(client, { nameOrNames: data.name, duration: data.duration })
  const value = price.base + price.premium
  const valueWithBuffer = calculateValueWithBuffer(value)

  return registerName.makeFunctionData(connectorClient, {
    ...data,
    value: valueWithBuffer,
  })
}

export default { displayItems, transaction } satisfies Transaction<Data>
