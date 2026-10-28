import { parseAbi } from 'viem'

export const namePolicyBonaFideAbi = parseAbi([
  'function bonaFideNames(bytes32 labelhash) view returns (bool)',
  'function termsHash() view returns (bytes32)',
  'function termsText() view returns (string)',
  'function acceptedTerms(bytes32 commitment, address acceptor) view returns (bytes32)',
  'function acceptedClaimTerms(uint256 tokenId, address from, address recipient, uint256 offer) view returns (bytes32)',
  'function commitUnderBonaFideCommunityTerms(bytes32 commitment, bytes32 acceptedTermsHash)',
  'function acceptBonaFideCommunityTermsForClaim(uint256 tokenId, address from, uint256 offer, bytes32 acceptedTermsHash)',
])
