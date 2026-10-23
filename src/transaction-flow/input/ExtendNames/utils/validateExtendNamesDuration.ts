import { MIN_RENEWAL_DURATION } from '@app/constants/simplex'
import { ONE_YEAR } from '@app/utils/time'

export const validateExtendNamesDuration = ({
  duration,
  minDuration = MIN_RENEWAL_DURATION,
  defaultDuration = ONE_YEAR,
}: {
  duration?: unknown
  minDuration?: number
  defaultDuration?: number
}): number | null => {
  if (duration === null) return null
  const parsedDuration = parseInt(duration as string, 10)
  if (Number.isNaN(parsedDuration) || parsedDuration < 0) return defaultDuration
  if (parsedDuration < minDuration) return minDuration
  return parsedDuration
}
