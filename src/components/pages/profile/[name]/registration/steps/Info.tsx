import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { makeCommitment } from '@ensdomains/ensjs/utils'
import { Button, Heading, Helper, Typography } from '@ensdomains/thorin'

import MobileFullWidth from '@app/components/@atoms/MobileFullWidth'
import { Card } from '@app/components/Card'
import { useAccountSafely } from '@app/hooks/account/useAccountSafely'
import { useEstimateFullRegistration } from '@app/hooks/gasEstimation/useEstimateRegistration'
import { useIntentSigner } from '@app/hooks/useIntentSigner'
import useRegistrationParams from '@app/hooks/useRegistrationParams'
import { signingErrorMessage } from '@app/utils/snrcIntents'
import { Credit, isSignedFor, Partner } from '@app/utils/snrcSponsor'

import AllowanceInvoice from '../AllowanceInvoice'
import FullInvoice from '../FullInvoice'
import { RegistrationReducerDataItem } from '../types'

const StyledCard = styled(Card)(
  ({ theme }) => css`
    max-width: 780px;
    margin: 0 auto;
    flex-direction: column;
    gap: ${theme.space['4']};
    padding: ${theme.space['4']};

    @media (min-width: ${theme.breakpoints.sm}px) {
      padding: ${theme.space['6']} ${theme.space['18']};
      gap: ${theme.space['6']};
    }
  `,
)

const InfoItems = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: ${theme.space['4']};

    @media (min-width: ${theme.breakpoints.sm}px) {
      flex-direction: row;
      align-items: stretch;
    }
  `,
)

const InfoItem = styled.div(
  ({ theme }) => css`
    width: 100%;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.space['4']};

    padding: ${theme.space['4']};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.radii.large};
    text-align: center;

    & > div:first-of-type {
      width: ${theme.space['10']};
      height: ${theme.space['10']};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${theme.fontSizes.extraLarge};
      font-weight: ${theme.fontWeights.bold};
      color: ${theme.colors.backgroundPrimary};
      background: ${theme.colors.accentPrimary};
      border-radius: ${theme.radii.full};
    }

    & > div:last-of-type {
      flex-grow: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `,
)

const ButtonContainer = styled.div(
  ({ theme }) => css`
    width: ${theme.space.full};
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: ${theme.space['2']};
  `,
)

const ProfileButton = styled.button(
  () => css`
    cursor: pointer;
  `,
)

const infoItemArr = Array.from({ length: 3 }, (_, i) => `steps.info.ethItems.${i}`)

type Props = {
  registrationData: RegistrationReducerDataItem
  name: string
  callback: (data: { back: boolean; credit?: Credit }) => void
  onProfileClick: () => void
}

const Info = ({ registrationData, name, callback, onProfileClick }: Props) => {
  const { t } = useTranslation('register')

  const estimate = useEstimateFullRegistration({
    name,
    registrationData,
  })

  const { address } = useAccountSafely()
  const { credit } = registrationData
  const partner = credit?.partner
  const registrationParams = useRegistrationParams({
    name,
    owner: partner?.owner ?? address!,
    registrationData,
  })
  const { signAcceptTerms, signRegisterName } = useIntentSigner()
  const partnerSignatures = useMutation({
    mutationFn: async (signing: Credit & { partner: Partner }) => {
      const commitment = makeCommitment(registrationParams)
      const { terms } = registrationData
      const intents = {
        commitment,
        terms:
          terms && (await signAcceptTerms({ owner: signing.partner.owner, commitment, terms })),
        register: await signRegisterName({
          registrationParams,
          disputeDays: signing.disputeDays,
        }),
      }
      return { ...signing, partner: { ...signing.partner, intents } }
    },
    onSuccess: (signedCredit) => callback({ back: false, credit: signedCredit }),
  })

  const begin = () => {
    if (credit?.partner && !isSignedFor(credit.partner, makeCommitment(registrationParams)))
      partnerSignatures.mutate({ ...credit, partner: credit.partner })
    else callback({ back: false })
  }

  return (
    <StyledCard>
      <Heading>{t('steps.info.heading')}</Heading>
      <Typography>{t('steps.info.subheading')}</Typography>
      <InfoItems>
        {infoItemArr.map((item, inx) => (
          <InfoItem key={item}>
            <Typography>{inx + 1}</Typography>
            <Typography>{t(item)}</Typography>
          </InfoItem>
        ))}
      </InfoItems>
      {registrationData.credit ? (
        <AllowanceInvoice name={name} seconds={registrationData.seconds} />
      ) : (
        <FullInvoice {...estimate} />
      )}
      {partner && (
        <Helper alert="info">{t('steps.info.partner', { owner: partner.owner })}</Helper>
      )}
      {partnerSignatures.error && (
        <Helper alert="error">{signingErrorMessage(partnerSignatures.error)}</Helper>
      )}
      {!registrationData.queue.includes('profile') && (
        <ProfileButton data-testid="setup-profile-button" onClick={onProfileClick}>
          <Typography weight="bold" color="accent">
            {t('steps.info.setupProfile')}
          </Typography>
        </ProfileButton>
      )}
      <ButtonContainer>
        <MobileFullWidth>
          <Button colorStyle="accentSecondary" onClick={() => callback({ back: true })}>
            {t('action.back', { ns: 'common' })}
          </Button>
        </MobileFullWidth>
        <MobileFullWidth>
          <Button
            data-testid="next-button"
            loading={partnerSignatures.isPending}
            disabled={partnerSignatures.isPending}
            onClick={begin}
          >
            {t('action.begin', { ns: 'common' })}
          </Button>
        </MobileFullWidth>
      </ButtonContainer>
    </StyledCard>
  )
}

export default Info
