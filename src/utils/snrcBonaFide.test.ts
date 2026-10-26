import { keccak256 } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchBonaFideTerms } from './snrcBonaFide'

const serve = (body: Uint8Array | string, init: ResponseInit = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(body, { headers: { 'content-type': 'text/markdown' }, ...init }),
    ),
  )

describe('snrcBonaFide', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hashes the exact bytes it fetches', async () => {
    const text = '# Terms\n\nÜnicode stays byte-exact.\n'
    const bytes = new Uint8Array(Buffer.from(text, 'utf8'))
    serve(bytes)
    expect(await fetchBonaFideTerms('/bona-fide-terms.simplex.md')).toEqual({
      text,
      hash: keccak256(bytes),
    })
  })

  it('throws for a missing file, an HTML page or bytes that are not UTF-8', async () => {
    serve('', { status: 404 })
    await expect(fetchBonaFideTerms('/bona-fide-terms.testing.md')).rejects.toThrow()
    serve('<html></html>', { headers: { 'content-type': 'text/html' } })
    await expect(fetchBonaFideTerms('/bona-fide-terms.simplex.md')).rejects.toThrow()
    serve('terms', { headers: { 'content-type': 'application/octet-stream' } })
    await expect(fetchBonaFideTerms('/bona-fide-terms.simplex.md')).rejects.toThrow()
    serve(new Uint8Array([0xff, 0xfe, 0x41]))
    await expect(fetchBonaFideTerms('/bona-fide-terms.simplex.md')).rejects.toThrow()
  })
})
