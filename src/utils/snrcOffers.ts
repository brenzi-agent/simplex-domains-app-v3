import { labelhash, parseAbi } from 'viem'

// BaseRegistrarImplementation's offer/claim surface. A transfer is an offer
// (`approve`) followed by the recipient taking the name (`transferFrom` to
// itself); pushing a name to anyone else reverts `RecipientMustBeCaller`.
export const registrarOfferAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function offers(uint256 tokenId) view returns (uint256)',
  'function approve(address to, uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
])

/** The ERC-721 token id of an SNRC 2LD, or undefined for any other name. */
export const getSnrcTokenId = (name?: string) => {
  const labels = name?.split('.') ?? []
  if (labels.length !== 2 || !['testing', 'simplex'].includes(labels[1])) return undefined
  return BigInt(labelhash(labels[0]))
}
