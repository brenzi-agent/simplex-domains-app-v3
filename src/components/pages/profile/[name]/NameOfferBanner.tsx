import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'
import { useAccount } from 'wagmi'

import { Banner, Button } from '@ensdomains/thorin'

import { useNameOffer } from '@app/hooks/useNameOffer'
import { createTransactionItem } from '@app/transaction-flow/transaction'
import { useTransactionFlow } from '@app/transaction-flow/TransactionFlowProvider'
import { shortenAddress } from '@app/utils/utils'

const Actions = styled.div(
  ({ theme }) => css`
    display: flex;
    justify-content: flex-end;
    margin-top: ${theme.space['2']};
  `,
)

/**
 * A pending offer of an SNRC 2LD: the recipient can review and claim it, the
 * holder can withdraw it. Everyone else sees nothing.
 */
export const NameOfferBanner = ({ name }: { name: string }) => {
  const { t } = useTranslation('profile')
  const { address } = useAccount()
  const offer = useNameOffer({ name })
  const { usePreparedDataInput, createTransactionFlow } = useTransactionFlow()
  const showClaimNameInput = usePreparedDataInput('ClaimName')

  const recipient = offer.data?.recipient
  if (!address || !recipient) return null
  const isRecipient = recipient.toLowerCase() === address.toLowerCase()
  const isHolder = offer.data?.holder.toLowerCase() === address.toLowerCase()

  if (isRecipient)
    return (
      <Banner alert="info" title={t('banner.offer.recipient.title', { name })}>
        {t('banner.offer.recipient.description', { holder: shortenAddress(offer.data!.holder) })}
        <Actions>
          <Button
            size="small"
            width="auto"
            data-testid="claim-name-button"
            onClick={() => showClaimNameInput(`claim-name-${name}`, { name })}
          >
            {t('banner.offer.recipient.action')}
          </Button>
        </Actions>
      </Banner>
    )

  if (isHolder)
    return (
      <Banner alert="info" title={t('banner.offer.holder.title')}>
        {t('banner.offer.holder.description', { recipient: shortenAddress(recipient) })}
        <Actions>
          <Button
            size="small"
            width="auto"
            colorStyle="accentSecondary"
            data-testid="withdraw-offer-button"
            onClick={() =>
              createTransactionFlow(`withdraw-offer-${name}`, {
                transactions: [createTransactionItem('withdrawOffer', { name })],
              })
            }
          >
            {t('banner.offer.holder.action')}
          </Button>
        </Actions>
      </Banner>
    )

  return null
}
