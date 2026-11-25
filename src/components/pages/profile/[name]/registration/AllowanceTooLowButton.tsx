import { useTranslation } from 'react-i18next'

import { Button } from '@ensdomains/thorin'

const AllowanceTooLowButton = () => {
  const { t } = useTranslation('register')

  return (
    <Button data-testid="next-button" disabled>
      {t('steps.pricing.allowanceTooLow')}
    </Button>
  )
}

export default AllowanceTooLowButton
