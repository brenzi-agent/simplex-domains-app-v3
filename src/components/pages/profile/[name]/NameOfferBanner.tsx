import { useTranslation } from 'react-i18next'

import { Banner } from '@ensdomains/thorin'

import { BannerMessageWithAction } from '@app/components/@atoms/BannerMessageWithAction/BannerMessageWithAction'
import { useNameOffer } from '@app/hooks/useNameOffer'
import { createTransactionItem } from '@app/transaction-flow/transaction'
import { useTransactionFlow } from '@app/transaction-flow/TransactionFlowProvider'

export const NameOfferBanner = ({ name }: { name: string }) => {
  const { t } = useTranslation('profile')
  const offer = useNameOffer({ name })
  const { usePreparedDataInput, createTransactionFlow } = useTransactionFlow()
  const showClaimNameInput = usePreparedDataInput('ClaimName')

  if (!offer.data?.recipient) return null
  const { holder, recipient, isHolder, isRecipient } = offer.data

  if (isRecipient)
    return (
      <Banner alert="info" title={t('banner.offer.recipient.title', { name })}>
        <BannerMessageWithAction
          content={t('banner.offer.recipient.description', { holder })}
          button={{
            children: t('banner.offer.recipient.action'),
            onClick: () => showClaimNameInput(`claim-name-${name}`, { name }),
          }}
        />
      </Banner>
    )

  if (isHolder)
    return (
      <Banner alert="info" title={t('banner.offer.holder.title')}>
        <BannerMessageWithAction
          content={t('banner.offer.holder.description', { recipient })}
          button={{
            children: t('banner.offer.holder.action'),
            colorStyle: 'accentSecondary',
            onClick: () =>
              createTransactionFlow(`withdraw-offer-${name}`, {
                transactions: [createTransactionItem('withdrawOffer', { name })],
              }),
          }}
        />
      </Banner>
    )

  return null
}
