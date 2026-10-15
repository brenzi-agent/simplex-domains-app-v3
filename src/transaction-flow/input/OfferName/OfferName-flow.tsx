import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Address } from 'viem'
import { useBytecode } from 'wagmi'

import { Button, Dialog, Helper, Typography } from '@ensdomains/thorin'

import { AvatarWithIdentifier } from '@app/components/@molecules/AvatarWithIdentifier/AvatarWithIdentifier'
import { useNameOffer } from '@app/hooks/useNameOffer'
import { createTransactionItem } from '@app/transaction-flow/transaction'
import { TransactionDialogPassthrough } from '@app/transaction-flow/types'

import { SearchView } from '../SendName/views/SearchView/SearchView'

type Data = {
  name: string
}

export type Props = {
  data: Data
} & TransactionDialogPassthrough

/**
 * The holder's half of a transfer: approve the recipient to take the name. The
 * name stays with the holder until the recipient claims it on the name's page.
 */
const OfferName = ({ data: { name }, dispatch, onDismiss }: Props) => {
  const { t } = useTranslation('transactionFlow')
  const offer = useNameOffer({ name })
  const form = useForm<{ query: string }>({ defaultValues: { query: '' } })
  const [recipient, setRecipient] = useState<Address>()
  const { data: recipientCode } = useBytecode({
    address: recipient,
    query: { enabled: !!recipient },
  })

  if (!recipient)
    return (
      <FormProvider {...form}>
        <SearchView name={name} senderRole="owner" onSelect={setRecipient} onCancel={onDismiss} />
      </FormProvider>
    )

  const holder = offer.data?.holder
  const isHolder = !!holder && recipient.toLowerCase() === holder.toLowerCase()
  const replaced = offer.data?.recipient

  const onConfirm = () => {
    dispatch({
      name: 'setTransactions',
      payload: [createTransactionItem('offerName', { name, recipient })],
    })
    dispatch({ name: 'setFlowStage', payload: 'transaction' })
  }

  return (
    <>
      <Dialog.Heading title={t('input.offerName.title', { name })} />
      <Dialog.Content data-testid="offer-name-confirm-view">
        <Typography>{t('input.offerName.description', { name })}</Typography>
        <AvatarWithIdentifier address={recipient} />
        {isHolder && <Helper alert="error">{t('input.offerName.toHolder')}</Helper>}
        {!!recipientCode && <Helper alert="warning">{t('input.offerName.contract')}</Helper>}
        {!!replaced && !isHolder && (
          <Helper alert="info">{t('input.offerName.replaces', { recipient: replaced })}</Helper>
        )}
      </Dialog.Content>
      <Dialog.Footer
        leading={
          <Button colorStyle="accentSecondary" onClick={() => setRecipient(undefined)}>
            {t('action.back', { ns: 'common' })}
          </Button>
        }
        trailing={
          <Button
            data-testid="offer-name-confirm"
            disabled={!holder || isHolder}
            onClick={onConfirm}
          >
            {t('action.next', { ns: 'common' })}
          </Button>
        }
      />
    </>
  )
}

export default OfferName
