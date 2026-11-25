import { useTranslation } from 'react-i18next'

import { Skeleton } from '@ensdomains/thorin'

import {
  Container as InvoiceContainer,
  LineItem as InvoiceLineItem,
} from '@app/components/@atoms/Invoice/Invoice'
import { useRegistrarAllowance } from '@app/hooks/useRegistrarAllowance'
import { makeDisplay } from '@app/utils/currency'
import { formatDurationOfDates } from '@app/utils/utils'

type Props = {
  name: string
  seconds: number
  estimatedGasFee?: bigint
}

const AllowanceInvoice = ({ name, seconds, estimatedGasFee }: Props) => {
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
      symbol: 'usd',
    },
    ...(price?.premium
      ? [{ label: t('invoice.temporaryPremium'), value: price.premium, symbol: 'usd' }]
      : []),
    { label: t('invoice.estimatedNetworkFee'), value: estimatedGasFee, symbol: 'eth' },
    {
      label: t('invoice.allowanceLeft'),
      value:
        allowance === undefined || !price ? undefined : allowance - price.base - price.premium,
      symbol: 'usd',
    },
  ]

  return (
    <InvoiceContainer>
      {items.map(({ label, value, symbol }) => (
        <InvoiceLineItem key={label}>
          <div>{label}</div>
          <Skeleton loading={value === undefined}>
            <div>{makeDisplay({ value: value ?? 0n, symbol })}</div>
          </Skeleton>
        </InvoiceLineItem>
      ))}
    </InvoiceContainer>
  )
}

export default AllowanceInvoice
