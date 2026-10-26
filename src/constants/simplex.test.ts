import { describe, expect, it } from 'vitest'

import { ONE_DAY } from '@app/utils/time'

import { MAX_SPONSORED_REGISTRATION_DURATION } from './simplex'

describe('SimplexController durations', () => {
  it('caps a reserved or sponsored registration at 4015 days', () => {
    expect(MAX_SPONSORED_REGISTRATION_DURATION).toBe(4015 * ONE_DAY)
  })
})
