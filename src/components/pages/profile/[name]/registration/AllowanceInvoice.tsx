import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { Skeleton } from '@ensdomains/thorin'

import { useRegistrarAllowance } from '@app/hooks/useRegistrarAllowance'
import { makeDisplay } from '@app/utils/currency'
import { formatDurationOfDates } from '@app/utils/utils'

const Container = styled.div(
  ({ theme }) => css`
    padding: ${theme.space['4']};
    background: ${theme.colors.backgroundSecondary};
    display: flex;
    flex-direction: column;
    gap: ${theme.space['2']};
    width: 100%;
    border-radius: ${theme.space['2']};
  `,
)

const LineItem = styled.div(
  ({ theme }) => css`
    display: flex;
    justify-content: space-between;
    line-height: ${theme.space['5']};
    color: ${theme.colors.grey};
  `,
)

type Props = {
  name: string
  seconds: number
}

const AllowanceInvoice = ({ name, seconds }: Props) => {
  const { t } = useTranslation(['register', 'common'])
  const { allowance, price } = useRegistrarAllowance({ name, seconds })

  const items = [
    {
      label: t('invoice.timeRegistration', {
        time: formatDurationOfDates({
          startDate: new Date(),
          endDate: new Date(Date.now() + seconds * 1000),
          t,
        }),
      }),
      value: price?.base,
    },
    ...(price?.premium ? [{ label: t('invoice.temporaryPremium'), value: price.premium }] : []),
    { label: t('invoice.allowanceLeft'), value: allowance },
  ]

  return (
    <Container>
      {items.map(({ label, value }) => (
        <LineItem key={label}>
          <div>{label}</div>
          <Skeleton loading={value === undefined}>
            <div>{makeDisplay({ value: value ?? 0n, symbol: 'usd' })}</div>
          </Skeleton>
        </LineItem>
      ))}
    </Container>
  )
}

export default AllowanceInvoice
