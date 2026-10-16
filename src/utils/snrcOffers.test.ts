import { labelhash } from 'viem'
import { describe, expect, it } from 'vitest'

import { getSnrcTokenId } from './snrcOffers'

describe('getSnrcTokenId', () => {
  it('returns the labelhash of a 2LD of the configured TLD as a token id', () => {
    expect(getSnrcTokenId('alice.testing')).toBe(BigInt(labelhash('alice')))
  })

  it('returns undefined for subnames and other TLDs', () => {
    expect(getSnrcTokenId('mobile.alice.testing')).toBeUndefined()
    expect(getSnrcTokenId('alice.simplex')).toBeUndefined()
    expect(getSnrcTokenId('alice.eth')).toBeUndefined()
    expect(getSnrcTokenId('testing')).toBeUndefined()
  })

  it('returns undefined for a label the app does not accept', () => {
    expect(getSnrcTokenId('alice!.testing')).toBeUndefined()
    expect(getSnrcTokenId('Alice.testing')).toBeUndefined()
    expect(getSnrcTokenId('caf\u{E9}.testing')).toBeUndefined()
    expect(getSnrcTokenId(`[${'ab'.repeat(32)}].testing`)).toBeUndefined()
  })
})
