import { labelhash } from 'viem'
import { describe, expect, it } from 'vitest'

import { getSnrcTokenId } from './snrcOffers'

describe('getSnrcTokenId', () => {
  it('returns the labelhash of an SNRC 2LD as a token id', () => {
    expect(getSnrcTokenId('alice.testing')).toBe(BigInt(labelhash('alice')))
    expect(getSnrcTokenId('alice.simplex')).toBe(BigInt(labelhash('alice')))
  })

  it('returns undefined for subnames, other TLDs and no name', () => {
    expect(getSnrcTokenId('mobile.alice.testing')).toBeUndefined()
    expect(getSnrcTokenId('alice.eth')).toBeUndefined()
    expect(getSnrcTokenId('testing')).toBeUndefined()
    expect(getSnrcTokenId(undefined)).toBeUndefined()
  })
})
