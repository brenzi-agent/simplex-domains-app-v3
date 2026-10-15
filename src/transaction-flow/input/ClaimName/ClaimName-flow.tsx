import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'
import { zeroAddress } from 'viem'

import { Button, CheckboxRow, Dialog, Helper, Typography } from '@ensdomains/thorin'

import { AvatarWithIdentifier } from '@app/components/@molecules/AvatarWithIdentifier/AvatarWithIdentifier'
import { useAccountSafely } from '@app/hooks/account/useAccountSafely'
import { useClaimChecks } from '@app/hooks/useClaimChecks'
import { useNameOffer } from '@app/hooks/useNameOffer'
import { useProfile } from '@app/hooks/useProfile'
import { createTransactionItem } from '@app/transaction-flow/transaction'
import { TransactionDialogPassthrough } from '@app/transaction-flow/types'
import { shortenAddress } from '@app/utils/utils'

import { SearchViewLoadingView } from '../SendName/views/SearchView/views/SearchViewLoadingView'

const List = styled.ul(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.space['1']};
    width: 100%;
    word-break: break-all;
  `,
)

type Data = {
  name: string
}

export type Props = {
  data: Data
} & TransactionDialogPassthrough

/**
 * The recipient's half of a transfer. Claiming takes the name with everything
 * its holder left under it, so the records, the registry resolver and every
 * subnode are shown first and must be acknowledged; the claim is never automatic.
 */
const ClaimName = ({ data: { name }, dispatch, onDismiss }: Props) => {
  const { t } = useTranslation('transactionFlow')
  const account = useAccountSafely()
  const offer = useNameOffer({ name })
  const checks = useClaimChecks({ name })
  const { data: profile, isLoading: isProfileLoading } = useProfile({ name })
  const [acknowledged, setAcknowledged] = useState(false)

  if (offer.isLoading || checks.isLoading || isProfileLoading) return <SearchViewLoadingView />

  const holder = offer.data?.holder
  const isOfferedToMe =
    !!account.address && offer.data?.recipient?.toLowerCase() === account.address.toLowerCase()
  const texts = profile?.texts ?? []
  const coins = profile?.coins ?? []
  const subnodes = checks.data?.subnodes ?? []

  const onConfirm = () => {
    if (!holder) return
    dispatch({
      name: 'setTransactions',
      payload: [createTransactionItem('claimName', { name, holder })],
    })
    dispatch({ name: 'setFlowStage', payload: 'transaction' })
  }

  return (
    <>
      <Dialog.Heading title={t('input.claimName.title', { name })} />
      <Dialog.Content data-testid="claim-name-view">
        {!isOfferedToMe && <Helper alert="error">{t('input.claimName.notOffered')}</Helper>}
        {holder && (
          <AvatarWithIdentifier address={holder} subtitle={t('input.claimName.offeredBy')} />
        )}
        <Typography>{t('input.claimName.description', { name })}</Typography>

        {checks.data && !checks.data.isDefaultResolver && (
          <Helper alert="warning">
            {t('input.claimName.resolver', { resolver: checks.data.resolver })}
          </Helper>
        )}

        <Typography fontVariant="bodyBold">{t('input.claimName.records')}</Typography>
        {texts.length + coins.length === 0 ? (
          <Typography color="grey">{t('input.claimName.none')}</Typography>
        ) : (
          <List data-testid="claim-name-records">
            {texts.map(({ key, value }) => (
              <li key={`text-${key}`}>
                <Typography fontVariant="small">
                  {key}: {value}
                </Typography>
              </li>
            ))}
            {coins.map(({ id, name: coin, value }) => (
              <li key={`coin-${id}`}>
                <Typography fontVariant="small">
                  {coin}: {value}
                </Typography>
              </li>
            ))}
          </List>
        )}

        <Typography fontVariant="bodyBold">{t('input.claimName.subnodes')}</Typography>
        {subnodes.length === 0 ? (
          <Typography color="grey">{t('input.claimName.none')}</Typography>
        ) : (
          <List data-testid="claim-name-subnodes">
            {subnodes.map((subnode) => (
              <li key={subnode.node}>
                <Typography fontVariant="small">
                  {subnode.tracked
                    ? subnode.name ?? t('input.claimName.unnamed', { node: subnode.node })
                    : t(
                        subnode.owner === zeroAddress
                          ? 'input.claimName.ownerless'
                          : 'input.claimName.shadow',
                        { node: subnode.node, owner: shortenAddress(subnode.owner) },
                      )}
                </Typography>
              </li>
            ))}
          </List>
        )}
        {subnodes.some((s) => !s.tracked) && (
          <Helper alert="warning">{t('input.claimName.shadowWarning')}</Helper>
        )}
        {checks.data && !checks.data.subnodesComplete && (
          <Helper alert="warning">{t('input.claimName.incomplete')}</Helper>
        )}
        {checks.isError && <Helper alert="warning">{t('input.claimName.incomplete')}</Helper>}

        <Helper alert="info">{t('input.claimName.afterwards')}</Helper>
        <CheckboxRow
          data-testid="claim-name-acknowledge"
          label={t('input.claimName.acknowledge')}
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
      </Dialog.Content>
      <Dialog.Footer
        leading={
          <Button colorStyle="accentSecondary" onClick={onDismiss}>
            {t('action.cancel', { ns: 'common' })}
          </Button>
        }
        trailing={
          <Button
            data-testid="claim-name-confirm"
            disabled={!isOfferedToMe || !holder || !acknowledged}
            onClick={onConfirm}
          >
            {t('action.claim', { ns: 'common' })}
          </Button>
        }
      />
    </>
  )
}

export default ClaimName
