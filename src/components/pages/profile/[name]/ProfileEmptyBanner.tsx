import { useTranslation } from 'react-i18next'

import { Banner } from '@ensdomains/thorin'

import { BannerMessageWithAction } from '@app/components/@atoms/BannerMessageWithAction/BannerMessageWithAction'
import { supportedSimplexRecordKeys } from '@app/constants/supportedSimplexRecordKeys'
import { useAbilities } from '@app/hooks/abilities/useAbilities'
import { useProfileActions } from '@app/hooks/pages/profile/[name]/profile/useProfileActions/useProfileActions'
import { useProfile } from '@app/hooks/useProfile'

import { profileToProfileRecords } from './registration/steps/Profile/profileRecordUtils'

export function ProfileEmptyBanner({ name }: { name: string }) {
  const { t } = useTranslation('profile')

  const { data: profile, isLoading: isProfileLoading } = useProfile({ name })
  const existingRecords = profileToProfileRecords(profile)
  const profileActions = useProfileActions({
    name,
  })
  const abilities = useAbilities({ name })
  const canEditRecords = abilities.data?.canEditRecords
  const records = existingRecords.filter(({ value }) => value)

  // SNRC: prompt to add a SimpleX link whenever neither simplex.contact nor
  // simplex.channel is set — regardless of other records (a fresh 2LD already has
  // an eth address record; a fresh subname has none).
  const hasSimplexLink = records.some(({ key }) =>
    supportedSimplexRecordKeys.includes(key as (typeof supportedSimplexRecordKeys)[number]),
  )

  const action = (profileActions.profileActions ?? []).find(
    (i) => i.label === t('tabs.profile.actions.editProfile.label'),
  )

  if (hasSimplexLink || isProfileLoading || !action || !canEditRecords) return null

  return (
    <Banner alert="info" title={t('banner.empty.title')} data-testid="profile-empty-banner">
      <BannerMessageWithAction
        content={t('banner.empty.description')}
        button={{
          children: t('banner.empty.action'),
          onClick: () => action.onClick(),
        }}
      />
    </Banner>
  )
}
