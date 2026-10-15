import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { Typography } from '@ensdomains/thorin'

import { Calendar } from '@app/components/@atoms/Calendar/Calendar'
import { PlusMinusControl } from '@app/components/@atoms/PlusMinusControl/PlusMinusControl'
import { roundDurationWithDay } from '@app/utils/date'
import { isInsideSafe } from '@app/utils/safe'
import { ONE_YEAR, yearsToSeconds } from '@app/utils/time'
import { formatDurationOfDates } from '@app/utils/utils'

const YearsViewSwitch = styled.button(
  ({ theme }) => css`
    color: ${theme.colors.bluePrimary};
    cursor: pointer;
    font-size: ${theme.fontSizes.small};
    font-weight: ${theme.fontWeights.bold};
  `,
)

const Container = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.space['2']};
    align-items: center;
    width: ${theme.space.full};
  `,
)

const now = Math.floor(Date.now() / 1000)

export const DateSelection = ({
  seconds,
  setSeconds,
  durationType,
  onChangeDurationType,
  name,
  minSeconds,
  maxSeconds,
  mode = 'register',
  expiry,
}: {
  seconds: number
  setSeconds: (seconds: number) => void
  durationType: 'years' | 'date'
  name?: string
  minSeconds: number
  maxSeconds?: number
  mode?: 'register' | 'extend'
  expiry?: number
  onChangeDurationType?: (type: 'years' | 'date') => void
}) => {
  const currentTime = expiry ?? now

  const { t } = useTranslation()

  useEffect(() => {
    if (minSeconds > seconds) setSeconds(minSeconds)
    else if (maxSeconds !== undefined && seconds > maxSeconds) setSeconds(maxSeconds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSeconds, maxSeconds, seconds])

  // 365-day years, as SimplexController counts them: a calendar year can be 366
  // days, which would push a three-year term past the contract's maximum.
  const dateInYears = Math.floor(seconds / ONE_YEAR)

  // When the duration type is years, normalise the seconds to a year value
  useEffect(() => {
    if (durationType === 'years' && currentTime) {
      setSeconds(yearsToSeconds(Math.max(1, dateInYears)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateInYears, durationType])

  const postFix = mode === 'register' ? ' registration. ' : ' extension. '

  const isSafeApp = isInsideSafe()

  return (
    <Container>
      {durationType === 'date' && !isSafeApp ? (
        <Calendar
          value={currentTime + seconds}
          onChange={(e) => {
            const { valueAsDate } = e.currentTarget
            if (valueAsDate) {
              setSeconds(roundDurationWithDay(valueAsDate, currentTime))
            }
          }}
          highlighted
          name={name}
          min={currentTime + minSeconds}
          max={maxSeconds === undefined ? undefined : currentTime + maxSeconds}
        />
      ) : (
        <PlusMinusControl
          highlighted
          minValue={Math.max(1, Math.ceil(minSeconds / ONE_YEAR))}
          maxValue={maxSeconds === undefined ? undefined : Math.floor(maxSeconds / ONE_YEAR)}
          value={dateInYears}
          onChange={(e) => {
            const newYears = parseInt(e.target.value)

            if (!Number.isNaN(newYears)) setSeconds(yearsToSeconds(newYears))
          }}
        />
      )}
      <Typography color="greyPrimary" fontVariant="smallBold" data-testid="date-selection-info">
        {durationType === 'years'
          ? t('unit.years', { count: dateInYears, ns: 'common' }) + postFix
          : formatDurationOfDates({
              startDate: new Date(currentTime * 1000),
              endDate: new Date((currentTime + seconds) * 1000),
              postFix,
              t,
            })}
        {!isSafeApp && (
          <YearsViewSwitch
            type="button"
            data-testid="date-selection"
            onClick={() => onChangeDurationType?.(durationType === 'years' ? 'date' : 'years')}
          >
            {t(`calendar.pick_by_${durationType === 'date' ? 'years' : 'date'}`, { ns: 'common' })}
          </YearsViewSwitch>
        )}
      </Typography>
    </Container>
  )
}
