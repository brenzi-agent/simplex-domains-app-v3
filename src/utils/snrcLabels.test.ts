import { describe, expect, it } from 'vitest'

import { getUnregistrableLabelsError, parseLabels } from './snrcLabels'

describe('parseLabels', () => {
  it('splits on newlines and commas, trims, and drops empty entries', () => {
    expect(parseLabels(' alice,bob\n\ncarol , ')).toEqual(['alice', 'bob', 'carol'])
  })

  it('returns no labels for blank input', () => {
    expect(parseLabels('  \n , ')).toEqual([])
  })
})

describe('getUnregistrableLabelsError', () => {
  it('accepts labels users can register', () => {
    expect(getUnregistrableLabelsError(['nike', 'simplex-chat', 'a1'])).toBeUndefined()
    expect(getUnregistrableLabelsError([])).toBeUndefined()
  })

  it('names every label users cannot register', () => {
    expect(
      getUnregistrableLabelsError(['Nike', 'nike', 'nestl\u{E9}', 'coin\u{200B}base', 'pay.pal']),
    ).toBe('Users cannot register: Nike, nestl\u{E9}, coin\u{200B}base, pay.pal')
  })
})
