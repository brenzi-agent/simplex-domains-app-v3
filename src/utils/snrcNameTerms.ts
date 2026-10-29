import { Hex, parseAbi } from 'viem'

export type TermsKind = 'name' | 'community'

export type Terms = { kind: TermsKind; hash: Hex }

export const namePolicyTermsAbi = parseAbi([
  'function bonaFideNames(bytes32 labelhash) view returns (bool)',
  'function nameTermsLink() view returns (string)',
  'function nameTermsHash() view returns (bytes32)',
  'function communityNameTermsLink() view returns (string)',
  'function communityNameTermsHash() view returns (bytes32)',
  'function acceptedTerms(bytes32 commitment, address acceptor) view returns (bytes32)',
  'function acceptedClaimTerms(uint256 tokenId, address from, address recipient, uint256 offer) view returns (bytes32)',
  'function commitUnderNameTerms(bytes32 commitment, bytes32 acceptedTermsHash)',
  'function commitUnderCommunityNameTerms(bytes32 commitment, bytes32 acceptedTermsHash)',
  'function acceptNameTermsForClaim(uint256 tokenId, address from, uint256 offer, bytes32 acceptedTermsHash)',
  'function acceptCommunityNameTermsForClaim(uint256 tokenId, address from, uint256 offer, bytes32 acceptedTermsHash)',
])
