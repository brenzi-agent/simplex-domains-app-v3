import { keccak256, parseAbi } from 'viem'

export const namePolicyBonaFideAbi = parseAbi([
  'function bonaFideNames(bytes32 labelhash) view returns (bool)',
  'function termsHash() view returns (bytes32)',
  'function acceptedTerms(bytes32 commitment, address acceptor) view returns (bytes32)',
  'function acceptedClaimTerms(uint256 tokenId, address from, address recipient, uint256 offer) view returns (bytes32)',
  'function commitUnderBonaFideCommunityTerms(bytes32 commitment, bytes32 acceptedTermsHash)',
  'function acceptBonaFideCommunityTermsForClaim(uint256 tokenId, address from, uint256 offer, bytes32 acceptedTermsHash)',
])

export const getBonaFideTermsPath = (tld: string) => `/bona-fide-terms.${tld}.md`

export const fetchBonaFideTerms = async (path: string) => {
  const response = await fetch(path)
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.startsWith('text/') || contentType.startsWith('text/html'))
    throw new Error(`No bona fide terms at ${path}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), hash: keccak256(bytes) }
}
