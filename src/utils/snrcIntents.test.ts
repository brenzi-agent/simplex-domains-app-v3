import {
  concat,
  encodeAbiParameters,
  hashTypedData,
  Hex,
  keccak256,
  labelhash,
  parseAbiParameters,
  toBytes,
} from 'viem'
import { describe, expect, it } from 'vitest'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import {
  makeAcceptTermsTypedData,
  makeApproveNameTypedData,
  makeRegisterNameTypedData,
} from './snrcIntents'

const MAINNET_NAME_POLICY = '0x5147b65f547b766dbaf520127e8f59834475021e'
const MAINNET_SPONSOR = '0xec9a522c756e46fb3e44d3405ffdd9368501eb78'
const MAINNET_REGISTRAR = '0x4c0589dbc22862babb25eb72d11bba49d84aabe8'
const MAINNET_NAME_POLICY_DOMAIN_SEPARATOR =
  '0x8dd0c9b1848960e99a3d4d3bd2c4b4accb901130a03426a54f25f009a0e62aca'
const MAINNET_SPONSOR_DOMAIN_SEPARATOR =
  '0xad8ebca656b2b2ac6a9cf6ac29360204b9e5ddc0916e65f3f8438fa370ee3c5a'
const MAINNET_REGISTRAR_DOMAIN_SEPARATOR =
  '0x5389ed6d8553d20912d30655a5a3ba7f9b028b82066e750750ee33ca3ca8e841'

const PARTNER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const COMMITMENT = `0x${'cc'.repeat(32)}` as const
const TERMS = `0x${'77'.repeat(32)}` as const
const DEADLINE = 1_900_000_000n

const contractDigest = (domainSeparator: Hex, structHash: Hex) =>
  keccak256(concat(['0x1901', domainSeparator, structHash]))

describe('the typed data the partner signs, hashed as the contracts at 6e035ada hash it', () => {
  it.each([
    [
      'general',
      'AcceptGeneralTerms(bytes32 commitment,bytes32 termsHash,uint256 nonce,uint256 deadline)',
      '0x794c5ed7da2f2f44d8e74d78bdc520a90bba04981d895a095bc7171f9ab70b51',
    ],
    [
      'community',
      'AcceptCommunityTerms(bytes32 commitment,bytes32 termsHash,uint256 nonce,uint256 deadline)',
      '0x52fcc0fa237416fc2f994a1e89d285c08004a15abb2e72dba3e2df9de2e06ec2',
    ],
  ] as const)('accepts the %s terms for a commitment on the name policy', (kind, type, hash) => {
    const typeHash = hash as Hex
    expect(keccak256(toBytes(type))).toBe(typeHash)
    const typedData = makeAcceptTermsTypedData({
      chainId: 1,
      namePolicy: MAINNET_NAME_POLICY,
      commitment: COMMITMENT,
      terms: { kind, hash: TERMS },
      nonce: 3n,
      deadline: DEADLINE,
    })
    expect(Object.keys(typedData.types)).toEqual([typedData.primaryType])
    expect(hashTypedData(typedData)).toBe(
      contractDigest(
        MAINNET_NAME_POLICY_DOMAIN_SEPARATOR,
        keccak256(
          encodeAbiParameters(parseAbiParameters('bytes32, bytes32, bytes32, uint256, uint256'), [
            typeHash,
            COMMITMENT,
            TERMS,
            3n,
            DEADLINE,
          ]),
        ),
      ),
    )
  })

  it('registers a name with its records to the partner on the sponsor', () => {
    const type =
      'RegisterName(string label,address owner,uint256 duration,address resolver,bytes[] data,uint256 disputeDays,uint256 nonce,uint256 deadline)'
    const typeHash = '0x799a78e785584cefb5f76cae6faf2327553af45ef5da9491d690f7d4b851e444'
    expect(keccak256(toBytes(type))).toBe(typeHash)
    const registrationParams: RegistrationParameters = {
      name: 'alicebob.simplex',
      owner: PARTNER,
      duration: 63072000,
      secret: `0x${'33'.repeat(32)}` as const,
      resolverAddress: '0x4444444444444444444444444444444444444444',
      records: {
        texts: [
          { key: 'simplex.contact', value: 'https://smp16.simplex.im/a#Q_abc' },
          { key: 'simplex.channel', value: 'https://smp16.simplex.im/c#Q_def' },
        ],
      },
    }
    const { data } = makeRegistrationCallData(registrationParams)
    expect(data).toHaveLength(2)
    const typedData = makeRegisterNameTypedData({
      chainId: 1,
      sponsor: MAINNET_SPONSOR,
      registrationParams,
      disputeDays: 14,
      nonce: 0n,
      deadline: DEADLINE,
    })
    expect(hashTypedData(typedData)).toBe(
      contractDigest(
        MAINNET_SPONSOR_DOMAIN_SEPARATOR,
        keccak256(
          encodeAbiParameters(
            parseAbiParameters(
              'bytes32, bytes32, address, uint256, address, bytes32, uint256, uint256, uint256',
            ),
            [
              typeHash,
              keccak256(toBytes('alicebob')),
              PARTNER,
              63072000n,
              '0x4444444444444444444444444444444444444444',
              keccak256(concat(data.map((call) => keccak256(call)))),
              14n,
              0n,
              DEADLINE,
            ],
          ),
        ),
      ),
    )
  })

  it('offers a name without an announcement on the registrar', () => {
    const type =
      'ApproveName(address from,address to,uint256 tokenId,bytes ephemeralPubKey,bytes1 viewTag,uint256 nonce,uint256 deadline)'
    const typeHash = '0x7f6256dde5034b55f37a1c154e8cd27311eacce02a376172783c424d4b8fe3a0'
    expect(keccak256(toBytes(type))).toBe(typeHash)
    const tokenId = BigInt(labelhash('alicebob'))
    const typedData = makeApproveNameTypedData({
      chainId: 1,
      registrar: MAINNET_REGISTRAR,
      from: PARTNER,
      to: RECIPIENT,
      tokenId,
      nonce: 1n,
      deadline: DEADLINE,
    })
    expect(hashTypedData(typedData)).toBe(
      contractDigest(
        MAINNET_REGISTRAR_DOMAIN_SEPARATOR,
        keccak256(
          encodeAbiParameters(
            parseAbiParameters(
              'bytes32, address, address, uint256, bytes32, bytes1, uint256, uint256',
            ),
            [typeHash, PARTNER, RECIPIENT, tokenId, keccak256('0x'), '0x00', 1n, DEADLINE],
          ),
        ),
      ),
    )
  })
})
