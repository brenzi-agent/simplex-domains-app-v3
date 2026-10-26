import { act, renderHook } from '@app/test-utils'

import { describe, expect, it } from 'vitest'

import { useTermsAcceptance } from './useTermsAcceptance'

const TERMS = `0x${'77'.repeat(32)}` as const
const NEW_TERMS = `0x${'88'.repeat(32)}` as const

describe('useTermsAcceptance', () => {
  it('keeps an acceptance only for the terms it was given for', () => {
    const { result, rerender } = renderHook(({ terms }) => useTermsAcceptance(terms, TERMS), {
      initialProps: { terms: TERMS as `0x${string}` },
    })
    expect(result.current.acceptedTermsHash).toBe(TERMS)
    rerender({ terms: NEW_TERMS })
    expect(result.current.acceptedTermsHash).toBeUndefined()
    act(() => result.current.setAccepted(true))
    expect(result.current.acceptedTermsHash).toBe(NEW_TERMS)
    act(() => result.current.setAccepted(false))
    expect(result.current.acceptedTermsHash).toBeUndefined()
  })
})
